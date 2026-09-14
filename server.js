const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// 1. CONEXIÓN A MONGODB ATLAS
// (Reemplaza con tu usuario, contraseña y la URL de tu cluster)
const MONGO_URI = "mongodb+srv://230110073_db_user:xs7o0j94Ba5caU9s@clustertics.fmsrmr3.mongodb.net/techstore?retryWrites=true&w=majority&appName=ClusterTics";

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
app.api = app.get('/api/productos', async (req, res) => {
  try {
    // Busca todos los productos que estén activos en la base de datos
    const productos = await Producto.find({ activo: true });
    res.json(productos); // Los devuelve en formato JSON
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

// 4. ENCENDER EL SERVIDOR EN EL PUERTO 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});