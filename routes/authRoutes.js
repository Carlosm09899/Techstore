const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { sendVerificationEmail } = require('../utils/sedEmails');

const router = express.Router();

// REGISTRO
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Nombre, correo y contraseña son obligatorios' });
    }
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'El correo ya está registrado' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');

    await User.create({
      name,
      email,
      password: hashedPassword,
      isVerified: false,
      verificationToken,
      verificationTokenExpires: new Date(Date.now() + 24 * 60 * 60 * 1000)
    });

    await sendVerificationEmail({ email, name, token: verificationToken });
    res.json({ message: 'Cuenta creada. Revisa tu correo para verificarla antes de iniciar sesión.' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al registrar', error: error.message });
  }
});

router.get('/verify-email/:token', async (req, res) => {
  try {
    const user = await User.findOne({
      verificationToken: req.params.token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).send('<h1>Enlace inválido o expirado</h1><p>Solicita un nuevo registro.</p>');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();
    res.send('<h1>¡Correo verificado correctamente!</h1><p>Ya puedes volver a la tienda e iniciar sesión.</p>');
  } catch (error) {
    console.error('Error al verificar el correo:', error.message);
    res.status(500).send('<h1>Error al verificar el correo</h1><p>Inténtalo de nuevo más tarde.</p>');
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (user.isVerified === false) {
      return res.status(403).json({ message: 'Debes verificar tu correo primero' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ message: 'Credenciales inválidas' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'La autenticación no está configurada' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '4h' });

    res.cookie('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 4 * 60 * 60 * 1000
    });

    res.json({
      message: 'Inicio de sesión exitoso',
      user: { name: user.name, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión', error: error.message });
  }
});

router.get('/me', async (req, res) => {
  try {
    if (!req.cookies.auth_token || !process.env.JWT_SECRET) {
      return res.status(401).json({ message: 'No hay una sesión activa' });
    }

    const payload = jwt.verify(req.cookies.auth_token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id).select('name email');

    if (!user) {
      return res.status(401).json({ message: 'La sesión no es válida' });
    }

    res.json({ user });
  } catch (error) {
    res.status(401).json({ message: 'La sesión expiró' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.json({ message: 'Sesión cerrada' });
});

module.exports = router;
