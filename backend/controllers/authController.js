const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { getUniqueSharePin } = require('../utils/pinHelper');
const { JWT_SECRET } = require('../middlewares/authMiddleware');

// Patrón de email válido
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registra un nuevo usuario
 */
exports.registerUser = async (req, res) => {
  const { 
    email, 
    password,
    name,
    lastname,
    username,
    major,
    university,
    semester,
    study_goal,
    reference_language,
    profile_image,
    active_grading_version_id
  } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos (email, password)' });
  }

  // Validar formato de email
  if (!EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'El formato del email no es válido.' });
  }

  // Validar fortaleza de contraseña
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    const sharePin = await getUniqueSharePin();

    const query = `INSERT INTO users (email, password_hash, name, lastname, username, major, university, semester, study_goal, reference_language, share_pin, profile_image, active_grading_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [email, passwordHash, name, lastname, username, major, university, semester || null, study_goal || null, reference_language || null, sharePin, profile_image || null, active_grading_version_id || 3], function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(409).json({ error: 'El correo ya está registrado.' });
        }
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      const newUserId = this.lastID;

      // ── Insertar registro por defecto en learning_analytics ────────────────
      const analyticsQuery = `
        INSERT INTO learning_analytics (user_id, subject_id, total_cards, total_reviews, correct_reviews, incorrect_reviews, avg_response_time_ms, mastery_percentage)
        VALUES (?, ?, 0, 0, 0, 0, 0, 0)
      `;
      db.run(analyticsQuery, [newUserId, null], (analyticsErr) => {
        if (analyticsErr) {
          console.warn(`[Analytics] Advertencia: No se pudo crear registro de analytics para userId=${newUserId}:`, analyticsErr.message);
          // No interrumpir el registro si falla analytics
        } else {
          console.log(`[Analytics] ✅ Registro de analytics creado para userId=${newUserId}`);
        }

        // Firmar token JWT
        const token = jwt.sign({ id: newUserId, email }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ 
          message: 'Usuario registrado exitosamente', 
          userId: newUserId,
          token
        });
      });
    });
  } catch (error) {
    console.error('Error en /api/register:', error);
    res.status(500).json({ error: 'Error al procesar el registro.' });
  }
};

/**
 * Inicia sesión con email y contraseña
 */
exports.loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Faltan campos requeridos (email, password)' });
  }

  try {
    const query = `SELECT * FROM users WHERE email = ?`;
    db.get(query, [email], async (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        return res.status(401).json({ error: 'Credenciales inválidas.' });
      }

      if (user.status === 'pending_deletion') {
        const deletionDate = new Date(user.deletion_date);
        const now = new Date();
        const daysRemaining = Math.ceil((deletionDate - now) / (1000 * 60 * 60 * 24));
        
        return res.status(200).json({
          status: 'pending_deletion',
          message: 'Tu cuenta está programada para eliminarse',
          deletion_date: user.deletion_date,
          days_remaining: Math.max(0, daysRemaining),
          user: { id: user.id, email: user.email, name: user.name }
        });
      }

      if (user.status === 'deleted') {
        return res.status(401).json({ error: 'Esta cuenta ha sido eliminada permanentemente.' });
      }

      db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

      // Firmar token JWT
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

      res.json({ 
        message: 'Login exitoso', 
        user: { id: user.id, email: user.email },
        token
      });
    });
  } catch (error) {
    console.error('Error en /api/login:', error);
    res.status(500).json({ error: 'Error al procesar el login.' });
  }
};

/**
 * Asocia un token biométrico a un usuario
 */
exports.enrollBiometric = (req, res) => {
  const { userId, biometric_token } = req.body;

  if (!userId || !biometric_token) {
    return res.status(400).json({ error: 'Se requiere userId y biometric_token.' });
  }

  if (typeof biometric_token !== 'string' || biometric_token.length < 32) {
    return res.status(400).json({ error: 'Token biométrico inválido.' });
  }

  db.run(
    `UPDATE users SET biometric_token = ? WHERE id = ?`,
    [biometric_token, userId],
    function (err) {
      if (err) {
        console.error('Error guardando biometric_token:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Usuario no encontrado.' });
      }
      res.json({ message: 'Token biométrico registrado correctamente.' });
    }
  );
};

/**
 * Inicia sesión usando un token biométrico
 */
exports.biometricLogin = (req, res) => {
  const { biometric_token } = req.body;

  if (!biometric_token || typeof biometric_token !== 'string' || biometric_token.length < 32) {
    return res.status(400).json({ error: 'Token biométrico inválido o ausente.' });
  }

  db.get(
    `SELECT id, email, name, lastname, username FROM users WHERE biometric_token = ?`,
    [biometric_token],
    (err, user) => {
      if (err) {
        console.error('Error en biometric-login:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      if (!user) {
        return res.status(401).json({ error: 'Autenticación biométrica fallida.' });
      }

      db.run(`UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?`, [user.id]);

      // Firmar token JWT
      const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '30d' });

      res.json({
        message: 'Login biométrico exitoso',
        user: { id: user.id, email: user.email },
        token
      });
    }
  );
};
