const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { sendWelcomeEmail } = require('../utils/sedEmails');

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

    await User.create({
      name,
      email,
      password: hashedPassword
    });

    try {
      await sendWelcomeEmail({ email, name });
    } catch (emailError) {
      console.error('La cuenta se creó, pero no se pudo enviar el correo de bienvenida:', emailError.message);
    }

    res.json({ message: '¡Cuenta creada con éxito! Gracias por registrarte en TechStore. Ya puedes iniciar sesión.' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al registrar', error: error.message });
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

    res.json({ message: 'Inicio de sesión exitoso' });
  } catch (error) {
    res.status(500).json({ message: 'Error en el servidor al iniciar sesión', error: error.message });
  }
});

module.exports = router;
