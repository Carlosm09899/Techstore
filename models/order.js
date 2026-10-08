const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  productoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nombre: { type: String, required: true },
  equipoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  equipoNombre: { type: String, required: true },
  cantidad: { type: Number, required: true, min: 1 },
  precioUnitario: { type: Number, required: true, min: 0 },
  subtotal: { type: Number, required: true, min: 0 },
  compatibilidad: { type: String, required: true }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  items: { type: [orderItemSchema], required: true, minlength: 1 },
  total: { type: Number, required: true, min: 0 },
  envio: {
    nombre: { type: String, required: true, trim: true, maxlength: 120 },
    telefono: { type: String, required: true, trim: true, maxlength: 30 },
    direccion: { type: String, required: true, trim: true, maxlength: 200 },
    ciudad: { type: String, required: true, trim: true, maxlength: 80 },
    estado: { type: String, required: true, trim: true, maxlength: 80 },
    codigoPostal: { type: String, required: true, trim: true, maxlength: 10 }
  },
  estado: {
    type: String,
    enum: ['Pendiente de pago', 'Pagada', 'En preparación', 'Enviada', 'Entregada', 'Cancelada'],
    default: 'Pendiente de pago'
  }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);
