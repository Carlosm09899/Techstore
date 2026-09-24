const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const authRoutes = require('./routes/authRoutes');

dotenv.config();

const app = express();
app.use(express.static(__dirname));
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use('/api/auth', authRoutes);

// 1. CONEXIÓN A MONGODB ATLAS
// (Reemplaza con tu usuario, contraseña y la URL de tu cluster)
const MONGO_URI = process.env.MONGODB_URI;

mongoose.connect(MONGO_URI)
  .then(() => console.log("¡Conectado exitosamente a MongoDB Atlas!"))
  .catch(err => console.error("Error de conexión:", err));

// 2. CREAR EL MODELO / ESQUEMA DE PRODUCTOS
// Esto le dice a Mongoose cómo buscar los datos en la colección "productos"
const productoSchema = new mongoose.Schema({
  nombre: String,
  categoria: String,
  precio: Number,
  stock: Number,
  descripcion_corta: String,
  imagen_url: String,
  tipo_producto: String,
  detalles_tecnicos: Object,
  activo: Boolean
});

const Producto = mongoose.model('Producto', productoSchema, 'productos');

// 3. CREAR LA RUTA (ENDPOINT) PARA OBTENER LOS PRODUCTOS
app.get('/api/productos', async (req, res) => {
  try {
    const filtro = { activo: true };
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria;
    }

    const productos = await Producto.find(filtro);
    res.json(productos); // Los devuelve en formato JSON
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

// 4. ENCENDER EL SERVIDOR EN EL PUERTO 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});