const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

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

// 4. ENVIAR MENSAJES DEL FORMULARIO DE CONTACTO
app.post('/api/contacto', async (req, res) => {
  const { nombre, emailUsuario, mensaje } = req.body;

  if (!nombre || !emailUsuario || !mensaje) {
    return res.status(400).json({ message: 'Todos los campos son obligatorios' });
  }

  if (!process.env.BREVO_API_KEY || !process.env.EMAIL_FROM) {
    console.error('Faltan BREVO_API_KEY o EMAIL_FROM en el archivo .env');
    return res.status(500).json({ message: 'El servicio de correo no está configurado' });
  }

  try {
    const respuesta = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': process.env.BREVO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sender: { name: 'TechStore', email: process.env.EMAIL_FROM },
        to: [{ email: process.env.EMAIL_FROM, name: 'TechStore' }],
        replyTo: { email: emailUsuario, name: nombre },
        subject: `Nuevo mensaje de contacto de ${nombre}`,
        htmlContent: `<p><strong>Nombre:</strong> ${nombre}</p><p><strong>Correo:</strong> ${emailUsuario}</p><p><strong>Mensaje:</strong></p><p>${mensaje}</p>`
      })
    });

    if (!respuesta.ok) {
      const detalle = await respuesta.text();
      console.error('Brevo rechazó el correo:', respuesta.status, detalle);
      return res.status(502).json({ message: 'El proveedor de correo rechazó el mensaje' });
    }

    res.json({ message: 'Mensaje enviado correctamente' });
  } catch (error) {
    console.error('Error al enviar el correo de contacto:', error.message);
    res.status(500).json({ message: 'No se pudo enviar el mensaje' });
  }
});

// 5. ENCENDER EL SERVIDOR EN EL PUERTO 3000
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});