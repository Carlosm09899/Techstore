const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const authRoutes = require('./routes/authRoutes');
const User = require('./models/user');
const Order = require('./models/order');

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
  compatibilidad: {
    tipoComponente: {
      type: String,
      enum: ['RAM', 'ALMACENAMIENTO', 'OTRO'],
      default: 'OTRO'
    },
    ramTipos: {
      type: [String],
      enum: ['DDR3', 'DDR4', 'DDR5', 'LPDDR4', 'LPDDR5'],
      default: []
    },
    almacenamientoTipos: {
      type: [String],
      enum: ['SATA 2.5"', 'SATA M.2', 'NVMe M.2'],
      default: []
    },
    capacidadMinimaGB: { type: Number, min: 1 },
    capacidadMaximaGB: { type: Number, min: 1 }
  },
  activo: Boolean
});

const Producto = mongoose.model('Producto', productoSchema, 'productos');

function normalizarTexto(valor) {
  if (valor === undefined || valor === null) return '';
  return String(valor).toLowerCase();
}

function obtenerReglasCompatibilidad(producto) {
  const reglas = producto.compatibilidad;
  return {
    tipoComponente: reglas?.tipoComponente || 'OTRO',
    ramTipos: Array.isArray(reglas?.ramTipos) ? reglas.ramTipos : [],
    almacenamientoTipos: Array.isArray(reglas?.almacenamientoTipos) ? reglas.almacenamientoTipos : [],
    capacidadMinimaGB: reglas?.capacidadMinimaGB || null,
    capacidadMaximaGB: reglas?.capacidadMaximaGB || null
  };
}

function tiposAlmacenamiento(tipo) {
  return tipo === 'SATA 2.5"' ? ['SATA_25']
    : tipo === 'SATA M.2' ? ['SATA_M2']
      : tipo === 'NVMe M.2' ? ['NVME_M2']
        : tipo === 'SATA 2.5" y NVMe M.2' ? ['SATA_25', 'NVME_M2']
        : [];
}

function validarCompatibilidadProducto(producto, equipo) {
  const reglas = obtenerReglasCompatibilidad(producto);
  if (reglas.tipoComponente === 'RAM') {
    if (!reglas.ramTipos.length || !equipo.ramTipo) {
      return { ok: false, message: 'La compatibilidad de RAM está incompleta' };
    }
    return reglas.ramTipos.includes(equipo.ramTipo)
      ? { ok: true, message: `RAM compatible: ${equipo.ramTipo}` }
      : { ok: false, message: `RAM incompatible: requiere ${reglas.ramTipos.join(', ')}` };
  }

  if (reglas.tipoComponente === 'ALMACENAMIENTO') {
    if (!reglas.almacenamientoTipos.length || !equipo.almacenamientoTipo) {
      return { ok: false, message: 'La compatibilidad de almacenamiento está incompleta' };
    }
    const tiposEquipo = tiposAlmacenamiento(equipo.almacenamientoTipo);
    const compatible = reglas.almacenamientoTipos.some((tipo) => tiposEquipo.includes(tipo));
    return compatible
      ? { ok: true, message: `Almacenamiento compatible: ${reglas.almacenamientoTipos.join(', ')}` }
      : { ok: false, message: `Almacenamiento incompatible: requiere ${reglas.almacenamientoTipos.join(', ')}` };
  }

  return { ok: false, message: 'Este producto no tiene reglas de compatibilidad' };
}

function obtenerIdUsuario(req, res) {
  if (!req.cookies.auth_token || !process.env.JWT_SECRET) {
    res.status(401).json({ message: 'Debes iniciar sesión para confirmar la compra' });
    return null;
  }
  try {
    return jwt.verify(req.cookies.auth_token, process.env.JWT_SECRET).id;
  } catch (error) {
    res.status(401).json({ message: 'La sesión expiró' });
    return null;
  }
}

// 3. CREAR LA RUTA (ENDPOINT) PARA OBTENER LOS PRODUCTOS
app.get('/api/productos', async (req, res) => {
  try {
    const filtro = { activo: true };
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria;
    }

    const productos = await Producto.find(filtro).lean();
    const productosConCompatibilidad = productos.map((producto) => ({
      ...producto,
      compatibilidad: obtenerReglasCompatibilidad(producto)
    }));
    res.json(productosConCompatibilidad); // Los devuelve en formato JSON
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;

    const { items, envio } = req.body;
    if (!Array.isArray(items) || items.length === 0 || !envio) {
      return res.status(400).json({ message: 'El carrito y los datos de envío son obligatorios' });
    }

    const camposEnvio = ['nombre', 'telefono', 'direccion', 'ciudad', 'estado', 'codigoPostal'];
    if (camposEnvio.some((campo) => !String(envio[campo] || '').trim())) {
      return res.status(400).json({ message: 'Completa todos los datos de envío' });
    }

    const user = await User.findById(userId).select('equipos');
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });

    if (items.some((item) => !mongoose.Types.ObjectId.isValid(item.productoId)
      || !mongoose.Types.ObjectId.isValid(item.equipoId))) {
      return res.status(400).json({ message: 'El carrito contiene un producto o equipo no válido' });
    }

    const ids = items.map((item) => item.productoId);
    const productos = await Producto.find({ _id: { $in: ids }, activo: true }).lean();
    const ordenItems = [];
    let total = 0;
    const cantidadesPorProducto = new Map();

    for (const item of items) {
      const cantidad = Number(item.cantidad);
      if (!Number.isInteger(cantidad) || cantidad < 1) {
        return res.status(400).json({ message: 'La cantidad de un producto no es válida' });
      }

      const producto = productos.find((elemento) => String(elemento._id) === String(item.productoId));
      const equipo = user.equipos.id(item.equipoId);
      if (!producto || !equipo) {
        return res.status(409).json({ message: 'Un producto o equipo del carrito ya no está disponible' });
      }
      if (!Number.isFinite(producto.precio) || Number(item.precio) !== Number(producto.precio)) {
        return res.status(409).json({
          message: `El precio de ${producto.nombre} cambió. Actualiza tu carrito antes de continuar`
        });
      }

      const compatibilidad = validarCompatibilidadProducto(producto, equipo);
      if (!compatibilidad.ok) {
        return res.status(409).json({ message: `${producto.nombre}: ${compatibilidad.message}` });
      }

      const cantidadAcumulada = (cantidadesPorProducto.get(String(producto._id)) || 0) + cantidad;
      cantidadesPorProducto.set(String(producto._id), cantidadAcumulada);
      if (!Number.isFinite(producto.stock) || producto.stock < cantidadAcumulada) {
        return res.status(409).json({ message: `No hay stock suficiente para ${producto.nombre}` });
      }

      const subtotal = producto.precio * cantidad;
      total += subtotal;
      ordenItems.push({
        productoId: producto._id,
        nombre: producto.nombre,
        equipoId: equipo._id,
        equipoNombre: equipo.nombre,
        cantidad,
        precioUnitario: producto.precio,
        subtotal,
        compatibilidad: compatibilidad.message
      });
    }

    for (const [productoId, cantidad] of cantidadesPorProducto) {
      const productoDisponible = await Producto.findOne({
        _id: productoId,
        activo: true,
        stock: { $gte: cantidad }
      }).select('_id').lean();
      if (!productoDisponible) {
        return res.status(409).json({
          message: 'El stock cambió mientras se confirmaba la compra. Actualiza tu carrito e inténtalo nuevamente'
        });
      }
    }

    for (const [productoId, cantidad] of cantidadesPorProducto) {
      const actualizado = await Producto.updateOne(
        { _id: productoId, activo: true, stock: { $gte: cantidad } },
        { $inc: { stock: -cantidad } }
      );
      if (actualizado.modifiedCount !== 1) {
        return res.status(409).json({ message: 'El stock cambió mientras se confirmaba la compra. Inténtalo nuevamente' });
      }
    }

    const order = await Order.create({
      userId,
      items: ordenItems,
      total,
      envio: camposEnvio.reduce((datos, campo) => {
        datos[campo] = String(envio[campo]).trim();
        return datos;
      }, {})
    });

    res.status(201).json({
      message: 'Compra confirmada correctamente',
      orderId: order._id,
      total: order.total
    });
  } catch (error) {
    console.error('Error al crear la orden:', error.message);
    res.status(500).json({ message: 'No se pudo confirmar la compra' });
  }
});

app.get('/api/orders', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;

    const orders = await Order.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({ orders });
  } catch (error) {
    console.error('Error al obtener las compras:', error.message);
    res.status(500).json({ message: 'No se pudieron obtener tus compras' });
  }
});

// 4. ENCENDER EL SERVIDOR EN EL PUERTO 3000
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});