const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
  productoId: { type: mongoose.Schema.Types.ObjectId, ref: 'Producto', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  nombreUsuario: { type: String, required: true, trim: true, maxlength: 120 },
  estrellas: { type: Number, required: true, min: 1, max: 5 },
  comentario: { type: String, required: true, trim: true, maxlength: 500 }
}, { timestamps: true });

reviewSchema.index({ productoId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('Review', reviewSchema);
