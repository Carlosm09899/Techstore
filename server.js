const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
dotenv.config();

const authRoutes = require('./routes/authRoutes');
const User = require('./models/user');
const Order = require('./models/order');
const Review = require('./models/review');
const { productosIniciales } = require('./scripts/seedProducts');

const app = express();
app.use(express.static(__dirname));
app.use(express.json());
app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use('/api/auth', authRoutes);

async function proveedorRequest(url, options = {}) {
  const respuesta = await fetch(url, options);
  const texto = await respuesta.text();
  let data = {};
  try {
    data = texto ? JSON.parse(texto) : {};
  } catch {
    data = { message: texto };
  }
  if (!respuesta.ok) {
    const mensaje = data.error?.message
      || data.error_description
      || data.message
      || 'No se pudo comunicar con el proveedor de pagos';
    const error = new Error(mensaje);
    error.status = respuesta.status;
    throw error;
  }
  return data;
}

async function calcularTotalCheckout(userId, items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw Object.assign(new Error('El carrito está vacío'), { status: 400 });
  }
  if (items.some((item) => !item || typeof item !== 'object'
    || !mongoose.Types.ObjectId.isValid(item.productoId)
    || !mongoose.Types.ObjectId.isValid(item.equipoId))) {
    throw Object.assign(new Error('El carrito contiene un producto o equipo no válido'), { status: 400 });
  }

  const user = await User.findById(userId).select('equipos');
  if (!user) throw Object.assign(new Error('La sesión no es válida'), { status: 401 });

  const productos = await Producto.find({
    _id: { $in: items.map((item) => item.productoId) },
    activo: true
  }).lean();

  let total = 0;
  for (const item of items) {
    const cantidad = Number(item.cantidad);
    const producto = productos.find((elemento) => String(elemento._id) === String(item.productoId));
    const equipo = user.equipos.id(item.equipoId);
    if (!producto || !equipo) {
      throw Object.assign(new Error('Un producto o equipo del carrito ya no está disponible'), { status: 409 });
    }
    if (!Number.isInteger(cantidad) || cantidad < 1) {
      throw Object.assign(new Error('La cantidad de un producto no es válida'), { status: 400 });
    }
    if (!Number.isFinite(producto.precio) || Number(item.precio) !== Number(producto.precio)) {
      throw Object.assign(new Error(`El precio de ${producto.nombre} cambió. Actualiza tu carrito antes de continuar`), { status: 409 });
    }
    if (!Number.isFinite(producto.stock) || producto.stock < cantidad) {
      throw Object.assign(new Error(`No hay stock suficiente para ${producto.nombre}`), { status: 409 });
    }
    const compatibilidad = validarCompatibilidadProducto(producto, equipo);
    if (!compatibilidad.ok) {
      throw Object.assign(new Error(`${producto.nombre}: ${compatibilidad.message}`), { status: 409 });
    }
    total += producto.precio * cantidad;
  }
  return { total, currency: 'MXN' };
}

// 1. CONEXIÓN A MONGODB ATLAS
const MONGO_URI = process.env.MONGODB_URI;

async function sincronizarCatalogo() {
  try {
    const stockMinimo = 15;
    for (const producto of productosIniciales) {
      await Producto.updateOne(
        { nombre: producto.nombre },
        {
          $set: { ...producto, activo: true },
          $setOnInsert: { stock: stockMinimo }
        },
        { upsert: true }
      );
    }
    console.log(`Catálogo sincronizado exitosamente (${productosIniciales.length} productos).`);
  } catch (error) {
    console.warn("Aviso al sincronizar catálogo con MongoDB:", error.message);
  }
}

mongoose.connect(MONGO_URI)
  .then(() => {
    console.log("¡Conectado exitosamente a MongoDB Atlas!");
    sincronizarCatalogo();
  })
  .catch(err => console.error("Error de conexión:", err));

// 2. CREAR EL MODELO / ESQUEMA DE PRODUCTOS
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

// ESQUEMA PARA LECTURAS DEL SENSOR DHT22 (ESP32)
const lecturaDhtSchema = new mongoose.Schema({
  temperatura: { type: Number, required: true },
  humedad: { type: Number, required: true },
  dispositivo: { type: String, default: 'ESP32-Principal' }
}, { timestamps: true });

// Borra automáticamente lecturas mayores a 7 días (604800 seg) para ahorrar espacio en Atlas
lecturaDhtSchema.index({ createdAt: 1 }, { expireAfterSeconds: 604800 });

const LecturaDHT = mongoose.model('LecturaDHT', lecturaDhtSchema, 'lecturas_dht22');

function normalizarTexto(texto) {
  return String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function parsearLista(valor) {
  if (Array.isArray(valor)) {
    return valor.flatMap((item) => String(item || '').split(/[,\/]/)).map((item) => item.trim()).filter(Boolean);
  }
  if (typeof valor === 'string') {
    return valor.split(/[,\/]/).map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function obtenerReglasCompatibilidad(producto) {
  const reglas = producto.compatibilidad || {};
  let tipoComponente = String(reglas.tipoComponente || '').toUpperCase().trim();
  const tipoProd = String(producto.tipo_producto || '').toUpperCase().trim();
  const catProd = String(producto.categoria || '').toUpperCase();
  const nombreProd = String(producto.nombre || '').toUpperCase();

  if (!tipoComponente || tipoComponente === 'OTRO') {
    if (tipoProd === 'RAM' || nombreProd.includes('RAM') || catProd.includes('RAM') || nombreProd.match(/\bDDR[345]\b/)) {
      tipoComponente = 'RAM';
    } else if (tipoProd === 'SSD' || tipoProd === 'HDD' || catProd.includes('ALMACENAMIENTO') || nombreProd.includes('SSD') || nombreProd.includes('DISCO DURO') || nombreProd.includes('NVME')) {
      tipoComponente = 'ALMACENAMIENTO';
    } else if (tipoProd === 'BATERIA' || catProd.includes('LAPTOP') || nombreProd.includes('BATERIA') || nombreProd.includes('PANTALLA')) {
      tipoComponente = 'REPUESTO_LAPTOP';
    } else {
      tipoComponente = 'OTRO';
    }
  }

  let ramTipos = parsearLista(reglas.ramTipos);
  if (tipoComponente === 'RAM' && ramTipos.length === 0) {
    const textoBuscar = `${nombreProd} ${String(producto.descripcion_corta || '').toUpperCase()}`;
    const encontrados = textoBuscar.match(/\b(LPDDR5|LPDDR4|DDR5|DDR4|DDR3)\b/g);
    if (encontrados) ramTipos = Array.from(new Set(encontrados));
  }

  let almacenamientoTipos = parsearLista(reglas.almacenamientoTipos);
  if (tipoComponente === 'ALMACENAMIENTO' && almacenamientoTipos.length === 0) {
    const textoBuscar = normalizarTexto(`${nombreProd} ${producto.descripcion_corta || ''}`);
    if (textoBuscar.includes('nvme') || textoBuscar.includes('pcie')) almacenamientoTipos.push('NVMe M.2');
    else if (textoBuscar.includes('m.2') && textoBuscar.includes('sata')) almacenamientoTipos.push('SATA M.2');
    else if (textoBuscar.includes('sata') || textoBuscar.includes('disco') || textoBuscar.includes('hdd') || textoBuscar.includes('ssd')) almacenamientoTipos.push('SATA 2.5"');
  }

  return {
    tipoComponente,
    ramTipos,
    almacenamientoTipos,
    capacidadMinimaGB: reglas.capacidadMinimaGB || null,
    capacidadMaximaGB: reglas.capacidadMaximaGB || null
  };
}

function tiposAlmacenamiento(tipo) {
  const valor = normalizarTexto(tipo);
  const tipos = new Set();

  if (valor.includes('nvme') || valor.includes('pcie')) {
    tipos.add('NVME_M2');
  }
  if (valor.includes('sata') && (valor.includes('m.2') || valor.includes('m2'))) {
    tipos.add('SATA_M2');
  }
  if (valor.includes('sata') || valor.includes('2.5') || valor.includes('3.5') || valor.includes('hdd') || valor.includes('disco') || valor.includes('mecanico')) {
    tipos.add('SATA_25');
  }
  if (valor.includes('m.2') || valor.includes('m2')) {
    tipos.add('NVME_M2');
    tipos.add('SATA_M2');
  }
  if (valor.includes('ssd') && tipos.size === 0) {
    tipos.add('SATA_25');
    tipos.add('NVME_M2');
  }

  return Array.from(tipos);
}

function normalizarTiposReglaAlmacenamiento(tipos) {
  return parsearLista(tipos).flatMap((tipo) => tiposAlmacenamiento(tipo));
}

function validarCompatibilidadProducto(producto, equipo) {
  if (!equipo) {
    return { ok: false, message: 'Equipo no especificado para validar compatibilidad' };
  }

  const reglas = obtenerReglasCompatibilidad(producto);

  if (reglas.tipoComponente === 'RAM') {
    const ramEquipo = String(equipo.ramTipo || '').trim().toUpperCase();
    if (!ramEquipo) {
      return { ok: false, message: 'El equipo no tiene especificado su tipo de memoria RAM' };
    }

    const ramTiposProducto = reglas.ramTipos.map((r) => String(r || '').trim().toUpperCase());

    if (!ramTiposProducto.length) {
      return { ok: true, message: `Memoria compatible con equipos estándar (${ramEquipo})` };
    }

    const esCompatible = ramTiposProducto.some((ram) => {
      if (ram === ramEquipo) return true;
      if (ramEquipo.includes('DDR4') && ram.includes('DDR4')) return true;
      if (ramEquipo.includes('DDR5') && ram.includes('DDR5')) return true;
      if (ramEquipo.includes('DDR3') && ram.includes('DDR3')) return true;
      return false;
    });

    return esCompatible
      ? { ok: true, message: `RAM compatible: ${ramEquipo} (acepta ${ramTiposProducto.join(', ')})` }
      : { ok: false, message: `RAM incompatible: tu equipo usa ${ramEquipo} y el producto requiere ${ramTiposProducto.join(', ')}` };
  }

  if (reglas.tipoComponente === 'ALMACENAMIENTO') {
    const almacenamientoEquipo = String(equipo.almacenamientoTipo || '').trim();
    if (!almacenamientoEquipo) {
      return { ok: false, message: 'El equipo no tiene especificado su tipo de almacenamiento' };
    }

    const tiposEquipo = tiposAlmacenamiento(almacenamientoEquipo);
    if (equipo.tipo === 'PC' && !tiposEquipo.includes('SATA_25')) {
      tiposEquipo.push('SATA_25');
    }

    const tiposProducto = normalizarTiposReglaAlmacenamiento(reglas.almacenamientoTipos);
    if (!tiposProducto.length) {
      return { ok: true, message: `Almacenamiento compatible: ${almacenamientoEquipo}` };
    }

    const compatible = tiposProducto.some((tipo) => tiposEquipo.includes(tipo));
    return compatible
      ? { ok: true, message: `Almacenamiento compatible: tu equipo soporta ${almacenamientoEquipo}` }
      : { ok: false, message: `Almacenamiento incompatible: tu equipo soporta ${almacenamientoEquipo}, pero el producto requiere ${reglas.almacenamientoTipos.join(', ')}` };
  }

  if (reglas.tipoComponente === 'REPUESTO_LAPTOP') {
    if (equipo.tipo !== 'Laptop') {
      return { ok: false, message: 'Esta refacción está diseñada exclusivamente para computadoras portátiles (laptops)' };
    }
    return { ok: true, message: 'Compatible con laptops de arquitectura compatible' };
  }

  return { ok: true, message: 'Producto compatible con cualquier equipo registrado' };
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

// Middlewares de seguridad para Telemetría IoT
function validarSensorApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  if (!process.env.SENSOR_API_KEY || apiKey !== process.env.SENSOR_API_KEY) {
    return res.status(401).json({ message: 'API Key del sensor inválida o no configurada' });
  }
  next();
}

async function verificarAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    const token = req.cookies.auth_token || (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null);

    if (!token || !process.env.JWT_SECRET) {
      return res.status(401).json({ message: 'No autenticado' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const usuario = await User.findById(decoded.id).select('role rol isAdmin email').lean();

    if (!usuario) {
      return res.status(401).json({ message: 'Usuario no válido' });
    }

    const adminEmail = process.env.ADMIN_EMAIL
      ? String(process.env.ADMIN_EMAIL).trim().toLowerCase()
      : '';
    const esAdmin =
      usuario.isAdmin === true ||
      usuario.role === 'admin' ||
      usuario.rol === 'admin' ||
      Boolean(adminEmail && String(usuario.email || '').trim().toLowerCase() === adminEmail);

    if (!esAdmin) {
      return res.status(403).json({ message: 'Acceso denegado: solo administradores' });
    }

    req.adminUser = usuario;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Sesión expirada o inválida' });
  }
}

// 3. CREAR LAS RUTAS (ENDPOINTS) PARA PRODUCTOS, RESEÑAS Y ÓRDENES
app.get('/api/productos', async (req, res) => {
  try {
    const filtro = { activo: true };
    if (req.query.categoria) {
      filtro.categoria = req.query.categoria;
    }

    let productos = await Producto.find(filtro).lean();
    if (!productos || productos.length === 0) {
      productos = productosIniciales
        .filter((prod) => !filtro.categoria || prod.categoria === filtro.categoria)
        .map((prod) => ({
          ...prod,
          _id: new mongoose.Types.ObjectId(),
          stock: prod.stock || 15,
          activo: true
        }));
    }
    const productoIds = productos.map((producto) => producto._id);
    const resumenResenas = await Review.aggregate([
      { $match: { productoId: { $in: productoIds } } },
      {
        $group: {
          _id: '$productoId',
          promedio: { $avg: '$estrellas' },
          total: { $sum: 1 }
        }
      }
    ]);
    const resumenPorProducto = new Map(resumenResenas.map((resumen) => [
      String(resumen._id),
      { promedio: Number(resumen.promedio.toFixed(1)), total: resumen.total }
    ]));
    const productosConCompatibilidad = productos.map((producto) => ({
      ...producto,
      compatibilidad: obtenerReglasCompatibilidad(producto),
      resenas: resumenPorProducto.get(String(producto._id)) || { promedio: 0, total: 0 }
    }));
    res.json(productosConCompatibilidad);
  } catch (error) {
    res.status(500).json({ error: "Error al obtener los productos" });
  }
});

app.get('/api/productos/:productoId/resenas', async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.productoId)) {
      return res.status(400).json({ message: 'El producto no es válido' });
    }
    const resenas = await Review.find({ productoId: req.params.productoId })
      .sort({ createdAt: -1 })
      .select('nombreUsuario estrellas comentario createdAt')
      .lean();
    res.json({ resenas });
  } catch (error) {
    console.error('Error al obtener reseñas:', error.message);
    res.status(500).json({ message: 'No se pudieron obtener las reseñas' });
  }
});

app.post('/api/productos/:productoId/resenas', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;
    if (!mongoose.Types.ObjectId.isValid(req.params.productoId)) {
      return res.status(400).json({ message: 'El producto no es válido' });
    }

    const estrellas = Number(req.body.estrellas);
    const comentario = String(req.body.comentario || '').trim();
    if (!Number.isInteger(estrellas) || estrellas < 1 || estrellas > 5 || !comentario || comentario.length > 500) {
      return res.status(400).json({ message: 'Selecciona de 1 a 5 estrellas y escribe una reseña de hasta 500 caracteres' });
    }

    const productoId = new mongoose.Types.ObjectId(req.params.productoId);
    const compra = await Order.findOne({
      userId,
      'items.productoId': productoId,
      estado: { $ne: 'Cancelada' }
    }).sort({ createdAt: -1 }).lean();
    if (!compra) {
      return res.status(403).json({ message: 'Solo puedes reseñar productos que hayas comprado' });
    }

    const usuario = await User.findById(userId).select('name').lean();
    if (!usuario) return res.status(401).json({ message: 'La sesión no es válida' });

    const resena = await Review.create({
      productoId,
      userId,
      orderId: compra._id,
      nombreUsuario: usuario.name,
      estrellas,
      comentario
    });
    res.status(201).json({ message: 'Reseña publicada correctamente', resena });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Ya publicaste una reseña para este producto' });
    }
    console.error('Error al crear reseña:', error.message);
    res.status(500).json({ message: 'No se pudo publicar la reseña' });
  }
});

app.post('/api/payments/stripe/create-session', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: 'Stripe no está configurado en el servidor' });
    }

    const { items, envio } = req.body;
    const { total } = await calcularTotalCheckout(userId, items);
    if (!envio || typeof envio !== 'object') {
      return res.status(400).json({ message: 'Los datos de envío son obligatorios' });
    }

    const baseUrl = (process.env.API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const params = new URLSearchParams({
      mode: 'payment',
      'line_items[0][price_data][currency]': 'mxn',
      'line_items[0][price_data][unit_amount]': String(Math.round(total * 100)),
      'line_items[0][price_data][product_data][name]': 'Compra TechStore',
      'line_items[0][quantity]': '1',
      success_url: `${baseUrl}/?payment=stripe&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?payment=cancelled`,
      'payment_intent_data[metadata][userId]': String(userId),
      'metadata[userId]': String(userId)
    });

    const session = await proveedorRequest('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    res.json({ url: session.url });
  } catch (error) {
    console.error('Error al crear sesión de Stripe:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'No se pudo iniciar el pago con Stripe' });
  }
});

app.get('/api/payments/stripe/verify', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(503).json({ message: 'Stripe no está configurado en el servidor' });
    }
    const sessionId = String(req.query.session_id || '').trim();
    if (!sessionId) return res.status(400).json({ message: 'Falta el identificador de la sesión de Stripe' });

    const session = await proveedorRequest(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=payment_intent`, {
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
    });
    if (session.payment_status !== 'paid'
      || String(session.metadata?.userId || '') !== String(userId)
      || (session.payment_intent && typeof session.payment_intent === 'object' && session.payment_intent.status !== 'succeeded')) {
      return res.status(409).json({ message: 'El pago con tarjeta todavía no está confirmado' });
    }

    const transaccionId = typeof session.payment_intent === 'object'
      ? session.payment_intent.id
      : session.payment_intent;
    res.json({ verified: true, paymentId: sessionId, transactionId: transaccionId || sessionId });
  } catch (error) {
    console.error('Error al verificar pago de Stripe:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'No se pudo verificar el pago con Stripe' });
  }
});

app.post('/api/payments/paypal/create-order', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ message: 'PayPal no está configurado en el servidor' });
    }

    const { items } = req.body;
    const { total } = await calcularTotalCheckout(userId, items);
    const apiBase = (process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');
    const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const token = await proveedorRequest(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const baseUrl = (process.env.API_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
    const paypalOrder = await proveedorRequest(`${apiBase}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: String(userId),
          description: 'Compra TechStore',
          amount: { currency_code: 'MXN', value: total.toFixed(2) }
        }],
        application_context: {
          brand_name: 'TechStore',
          user_action: 'PAY_NOW',
          return_url: `${baseUrl}/?payment=paypal`,
          cancel_url: `${baseUrl}/?payment=cancelled`
        }
      })
    });
    const approvalUrl = (paypalOrder.links || []).find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) throw new Error('PayPal no devolvió una URL de aprobación');
    res.json({ id: paypalOrder.id, url: approvalUrl });
  } catch (error) {
    console.error('Error al crear orden de PayPal:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'No se pudo iniciar el pago con PayPal' });
  }
});

app.post('/api/payments/paypal/capture', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
      return res.status(503).json({ message: 'PayPal no está configurado en el servidor' });
    }
    const orderId = String(req.body.orderId || '').trim();
    if (!orderId) return res.status(400).json({ message: 'Falta el identificador de la orden de PayPal' });

    const apiBase = (process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');
    const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
    const token = await proveedorRequest(`${apiBase}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const captured = await proveedorRequest(`${apiBase}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });
    if (captured.status !== 'COMPLETED') {
      return res.status(409).json({ message: 'El pago con PayPal todavía no fue completado' });
    }
    const captureId = captured.purchase_units?.[0]?.payments?.captures?.find((capture) => capture.status === 'COMPLETED')?.id;
    res.json({ verified: true, paymentId: orderId, transactionId: captureId || orderId });
  } catch (error) {
    console.error('Error al capturar pago de PayPal:', error.message);
    res.status(error.status || 500).json({ message: error.message || 'No se pudo capturar el pago con PayPal' });
  }
});

app.post('/api/orders', async (req, res) => {
  try {
    const userId = obtenerIdUsuario(req, res);
    if (!userId) return;

    const { items, envio, metodoPago, paymentId, transactionId } = req.body;
    const metodoPagoSeleccionado = String(metodoPago || 'Paynet').trim() || 'Paynet';
    const metodosPagoPermitidos = ['Paynet', 'Tarjeta', 'PayPal'];

    if (!Array.isArray(items) || items.length === 0 || !envio || typeof envio !== 'object') {
      return res.status(400).json({ message: 'El carrito y los datos de envío son obligatorios' });
    }
    if (!metodosPagoPermitidos.includes(metodoPagoSeleccionado)) {
      return res.status(400).json({ message: 'El método de pago no es válido' });
    }

    if (metodoPagoSeleccionado === 'Tarjeta') {
      if (!process.env.STRIPE_SECRET_KEY || !String(paymentId || '').trim()) {
        return res.status(402).json({ message: 'El pago con tarjeta no ha sido confirmado' });
      }
      const session = await proveedorRequest(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(paymentId)}?expand[]=payment_intent`, {
        headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` }
      });
      if (session.payment_status !== 'paid'
        || String(session.metadata?.userId || '') !== String(userId)
        || (session.payment_intent && typeof session.payment_intent === 'object' && session.payment_intent.status !== 'succeeded')) {
        return res.status(402).json({ message: 'El pago con tarjeta no ha sido confirmado' });
      }
    }

    if (metodoPagoSeleccionado === 'PayPal') {
      if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET || !String(paymentId || '').trim()) {
        return res.status(402).json({ message: 'El pago con PayPal no ha sido confirmado' });
      }
      const apiBase = (process.env.PAYPAL_API_BASE_URL || 'https://api-m.sandbox.paypal.com').replace(/\/$/, '');
      const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
      const token = await proveedorRequest(`${apiBase}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basic}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      const captured = await proveedorRequest(`${apiBase}/v2/checkout/orders/${encodeURIComponent(paymentId)}`, {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });
      if (captured.status !== 'COMPLETED') {
        return res.status(402).json({ message: 'El pago con PayPal no ha sido confirmado' });
      }
      const customId = captured.purchase_units?.[0]?.custom_id;
      if (customId && String(customId) !== String(userId)) {
        return res.status(403).json({ message: 'La orden de PayPal no pertenece a esta cuenta' });
      }
    }

    if (metodoPagoSeleccionado !== 'Paynet') {
      const ordenExistente = await Order.findOne({ paymentProviderId: String(paymentId) }).select('_id').lean();
      if (ordenExistente) {
        return res.status(200).json({
          message: 'Compra ya registrada',
          orderId: ordenExistente._id,
          total: (await Order.findById(ordenExistente._id).select('total').lean()).total,
          metodoPago: metodoPagoSeleccionado
        });
      }
    }

    const camposEnvio = ['nombre', 'telefono', 'direccion', 'ciudad', 'estado', 'codigoPostal'];
    if (camposEnvio.some((campo) => !String(envio[campo] || '').trim())) {
      return res.status(400).json({ message: 'Completa todos los datos de envío' });
    }

    const user = await User.findById(userId).select('equipos');
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });

    if (items.some((item) => !item || typeof item !== 'object'
      || !mongoose.Types.ObjectId.isValid(item.productoId)
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
      metodoPago: metodoPagoSeleccionado,
      paymentProviderId: metodoPagoSeleccionado === 'Paynet' ? null : String(paymentId),
      pago: {
        estado: metodoPagoSeleccionado === 'Paynet' ? 'Pendiente' : 'Pagado',
        transaccionId: metodoPagoSeleccionado === 'Paynet' ? null : String(transactionId || paymentId)
      },
      estado: metodoPagoSeleccionado === 'Paynet' ? 'Pendiente de pago' : 'Pagada',
      envio: camposEnvio.reduce((datos, campo) => {
        datos[campo] = String(envio[campo]).trim();
        return datos;
      }, {})
    });

    res.status(201).json({
      message: 'Compra confirmada correctamente',
      orderId: order._id,
      total: order.total,
      metodoPago: order.metodoPago
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

// 4. RUTAS DE TELEMETRÍA SENSOR DHT22 (ESP32 -> MONGODB -> SOLO ADMIN)
app.post('/api/sensor/dht22', validarSensorApiKey, async (req, res) => {
  try {
    const temperatura = Number(req.body.temperatura);
    const humedad = Number(req.body.humedad);
    const dispositivo = String(req.body.dispositivo || 'ESP32-Principal').trim();

    if (!Number.isFinite(temperatura) || !Number.isFinite(humedad)) {
      return res.status(400).json({ message: 'Temperatura y humedad deben ser números válidos' });
    }

    const nuevaLectura = await LecturaDHT.create({
      temperatura,
      humedad,
      dispositivo
    });

    res.status(201).json({
      message: 'Lectura registrada',
      lectura: nuevaLectura
    });
  } catch (error) {
    console.error('Error al guardar lectura DHT22:', error.message);
    res.status(500).json({ message: 'Error interno al registrar lectura' });
  }
});

app.get('/api/sensor/dht22', verificarAdmin, async (req, res) => {
  try {
    const historial = await LecturaDHT.find()
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const actual = historial[0] || { temperatura: 0, humedad: 0, createdAt: null };

    res.json({
      actual,
      historial: historial.reverse()
    });
  } catch (error) {
    console.error('Error al obtener lecturas DHT22:', error.message);
    res.status(500).json({ message: 'Error al obtener lecturas del sensor' });
  }
});

// 5. ENCENDER EL SERVIDOR EN EL PUERTO 3000
const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en el puerto ${PORT} en ${HOST}`);
});