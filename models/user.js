const mongoose = require('mongoose');

const equipoSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true, maxlength: 80 },
  tipo: { type: String, required: true, enum: ['PC', 'Laptop'] },
  marca: { type: String, required: true, trim: true, maxlength: 80 },
  modelo: { type: String, required: true, trim: true, maxlength: 120 },
  sistema: { type: String, trim: true, maxlength: 80 },
  ramTipo: { type: String, required: true, enum: ['DDR3', 'DDR4', 'DDR5', 'LPDDR4', 'LPDDR5'] },
  ramCapacidad: { type: Number, min: 1, max: 2048 },
  ramRanuras: { type: Number, min: 1, max: 32 },
  almacenamientoTipo: {
    type: String,
    required: true,
    enum: ['SATA 2.5"', 'SATA M.2', 'NVMe M.2', 'SATA 2.5" y NVMe M.2']
  },
  almacenamientoCapacidad: { type: Number, min: 1, max: 100000 },
  procesador: { type: String, trim: true, maxlength: 120 },
  socket: { type: String, trim: true, maxlength: 40 },
  tarjetaGrafica: { type: String, trim: true, maxlength: 120 },
  fuentePotencia: { type: Number, min: 1, max: 5000 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const direccionSchema = new mongoose.Schema({
  alias: { type: String, required: true, trim: true, maxlength: 50 },
  nombre: { type: String, required: true, trim: true, maxlength: 120 },
  telefono: { type: String, required: true, trim: true, maxlength: 30 },
  direccion: { type: String, required: true, trim: true, maxlength: 200 },
  ciudad: { type: String, required: true, trim: true, maxlength: 80 },
  estado: { type: String, required: true, trim: true, maxlength: 80 },
  codigoPostal: { type: String, required: true, trim: true, maxlength: 10 },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String },
  verificationTokenExpires: { type: Date },
  equipos: { type: [equipoSchema], default: [] },
  direcciones: { type: [direccionSchema], default: [] }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);