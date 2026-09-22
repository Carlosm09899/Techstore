import express from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendVerificationEmail } from '../utils/sendEmail.js';

const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const token = crypto.randomBytes(32).toString('hex');

    await User.create({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken: token,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 horas
    });

    await sendVerificationEmail({ email, name, token, clientUrl: process.env.CLIENT_URL });
    res.json({ message: 'Registro exitoso. Revisa tu correo para activar tu cuenta.' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al registrar', error: error.message });
  }
});

// ACTIVACIÓN (Al dar clic en el link del correo)
router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.json({ message: '¡Cuenta activada con éxito!' });
  } catch (error) {
    res.status(500).json({ message: 'Error al verificar el correo', error: error.message });
  }
});

// LOGIN (Bloqueo si no ha verificado su correo)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (!user.isVerified) {
      return res.status(403).json({ message: 'Debes verificar tu correo primero' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '4h' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000
    });

    res.json({ message: 'Inicio de sesión exitoso' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión', error: error.message });
  }
});

export default router;