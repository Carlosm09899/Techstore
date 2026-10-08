const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { sendVerificationEmail } = require('../utils/sedEmails');

const router = express.Router();

function obtenerUsuarioAutenticado(req, res) {
  if (!req.cookies.auth_token || !process.env.JWT_SECRET) {
    res.status(401).json({ message: 'No hay una sesión activa' });
    return null;
  }

  try {
    const payload = jwt.verify(req.cookies.auth_token, process.env.JWT_SECRET);
    return payload.id;
  } catch (error) {
    res.status(401).json({ message: 'La sesión expiró' });
    return null;
  }
}

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

router.get('/equipos', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;

    const user = await User.findById(userId).select('equipos');
    if (!user) {
      return res.status(401).json({ message: 'La sesión no es válida' });
    }

    res.json({ equipos: user.equipos || [] });
  } catch (error) {
    console.error('Error al obtener los equipos:', error.message);
    res.status(500).json({ message: 'No se pudieron obtener los equipos' });
  }
});

function validarDatosEquipo(datos) {
  const {
    nombre, tipo, marca, modelo, ramTipo, almacenamientoTipo,
    procesador, socket, tarjetaGrafica, fuentePotencia
  } = datos;

  if (!nombre || !tipo || !marca || !modelo || !ramTipo || !almacenamientoTipo) {
    return 'Completa los campos obligatorios del equipo';
  }

  if (!['PC', 'Laptop'].includes(tipo)) {
    return 'El tipo de equipo no es válido';
  }

  if (tipo === 'Laptop' && (procesador || socket || tarjetaGrafica || fuentePotencia)) {
    return 'Una laptop no debe incluir componentes exclusivos de PC';
  }

  return null;
}

function obtenerDatosEquipo(body) {
  const {
    nombre, tipo, marca, modelo, sistema, ramTipo, ramCapacidad, ramRanuras,
    almacenamientoTipo, almacenamientoCapacidad, procesador, socket,
    tarjetaGrafica, fuentePotencia
  } = body;

  return {
    nombre, tipo, marca, modelo, sistema, ramTipo, ramCapacidad, ramRanuras,
    almacenamientoTipo, almacenamientoCapacidad, procesador, socket,
    tarjetaGrafica, fuentePotencia
  };
}

router.post('/equipos', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;

    const validationError = validarDatosEquipo(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'La sesión no es válida' });
    }

    user.equipos.push(obtenerDatosEquipo(req.body));
    await user.save();

    res.status(201).json({
      message: 'Equipo guardado correctamente',
      equipo: user.equipos[user.equipos.length - 1]
    });
  } catch (error) {
    console.error('Error al guardar el equipo:', error.message);
    res.status(500).json({ message: 'No se pudo guardar el equipo' });
  }
});

router.put('/equipos/:equipoId', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;

    const validationError = validarDatosEquipo(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'La sesión no es válida' });
    }

    const equipo = user.equipos.id(req.params.equipoId);
    if (!equipo) {
      return res.status(404).json({ message: 'El equipo no existe' });
    }

    Object.assign(equipo, obtenerDatosEquipo(req.body));
    await user.save();
    res.json({ message: 'Equipo actualizado correctamente', equipo });
  } catch (error) {
    console.error('Error al actualizar el equipo:', error.message);
    res.status(500).json({ message: 'No se pudo actualizar el equipo' });
  }
});

router.delete('/equipos/:equipoId', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({ message: 'La sesión no es válida' });
    }

    const equipo = user.equipos.id(req.params.equipoId);
    if (!equipo) {
      return res.status(404).json({ message: 'El equipo no existe' });
    }

    equipo.deleteOne();
    await user.save();
    res.json({ message: 'Equipo eliminado correctamente' });
  } catch (error) {
    console.error('Error al eliminar el equipo:', error.message);
    res.status(500).json({ message: 'No se pudo eliminar el equipo' });
  }
});

function validarDireccion(datos) {
  const campos = ['alias', 'nombre', 'telefono', 'direccion', 'ciudad', 'estado', 'codigoPostal'];
  return campos.some((campo) => !String(datos[campo] || '').trim())
    ? 'Completa todos los campos de la dirección'
    : null;
}

function obtenerDatosDireccion(body) {
  return ['alias', 'nombre', 'telefono', 'direccion', 'ciudad', 'estado', 'codigoPostal']
    .reduce((direccion, campo) => {
      direccion[campo] = String(body[campo]).trim();
      return direccion;
    }, {});
}

router.get('/direcciones', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;
    const user = await User.findById(userId).select('direcciones');
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });
    res.json({ direcciones: user.direcciones || [] });
  } catch (error) {
    console.error('Error al obtener las direcciones:', error.message);
    res.status(500).json({ message: 'No se pudieron obtener las direcciones' });
  }
});

router.post('/direcciones', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;
    const validationError = validarDireccion(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });
    user.direcciones.push(obtenerDatosDireccion(req.body));
    await user.save();
    res.status(201).json({
      message: 'Dirección guardada correctamente',
      direccion: user.direcciones[user.direcciones.length - 1]
    });
  } catch (error) {
    console.error('Error al guardar la dirección:', error.message);
    res.status(500).json({ message: 'No se pudo guardar la dirección' });
  }
});

router.put('/direcciones/:direccionId', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;
    const validationError = validarDireccion(req.body);
    if (validationError) return res.status(400).json({ message: validationError });

    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });
    const direccion = user.direcciones.id(req.params.direccionId);
    if (!direccion) return res.status(404).json({ message: 'La dirección no existe' });
    Object.assign(direccion, obtenerDatosDireccion(req.body));
    await user.save();
    res.json({ message: 'Dirección actualizada correctamente', direccion });
  } catch (error) {
    console.error('Error al actualizar la dirección:', error.message);
    res.status(500).json({ message: 'No se pudo actualizar la dirección' });
  }
});

router.delete('/direcciones/:direccionId', async (req, res) => {
  try {
    const userId = obtenerUsuarioAutenticado(req, res);
    if (!userId) return;
    const user = await User.findById(userId);
    if (!user) return res.status(401).json({ message: 'La sesión no es válida' });
    const direccion = user.direcciones.id(req.params.direccionId);
    if (!direccion) return res.status(404).json({ message: 'La dirección no existe' });
    direccion.deleteOne();
    await user.save();
    res.json({ message: 'Dirección eliminada correctamente' });
  } catch (error) {
    console.error('Error al eliminar la dirección:', error.message);
    res.status(500).json({ message: 'No se pudo eliminar la dirección' });
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
