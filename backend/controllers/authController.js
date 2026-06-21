const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { getUniqueSharePin } = require('../utils/pinHelper');
const { JWT_SECRET } = require('../middlewares/authMiddleware');
const { sendPasswordResetEmail } = require('../services/emailService');

// Patrón de email válido
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registra un nuevo usuario
 */
exports.registerUser = async (req, res) => {
  const { 
    id: clientId,
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

    const userId = clientId || uuidv4();
    const query = `INSERT INTO users (id, email, password_hash, name, lastname, username, major, university, semester, study_goal, reference_language, share_pin, profile_image, active_grading_version_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.run(query, [userId, email, passwordHash, name, lastname, username, major, university, semester || null, study_goal || null, reference_language || null, sharePin, profile_image || null, active_grading_version_id || 3], function (err) {
      if (err) {
        console.error('[Register] DB error:', err.message);
        console.error('[Register] Datos recibidos - email:', email, '| username:', username, '| id:', userId);
        if (err.message.includes('UNIQUE constraint failed')) {
          if (err.message.includes('users.username')) {
            return res.status(409).json({ error: 'El nombre de usuario ya está en uso. Por favor elige otro.' });
          }
          if (err.message.includes('users.email')) {
            return res.status(409).json({ error: 'El correo ya está registrado.' });
          }
          if (err.message.includes('users.id')) {
            return res.status(409).json({ error: 'ID de cuenta duplicado. Por favor reinicia el registro.' });
          }
          // Fallback: devolver el mensaje raw para depurar
          return res.status(409).json({ error: `Conflicto: ${err.message}` });
        }
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      // ── Insertar registro por defecto en learning_analytics ────────────────
      const analyticsQuery = `
        INSERT INTO learning_analytics (id, user_id, subject_id, total_cards, total_reviews, correct_reviews, incorrect_reviews, avg_response_time_ms, mastery_percentage)
        VALUES (?, ?, ?, 0, 0, 0, 0, 0, 0)
      `;
      db.run(analyticsQuery, [uuidv4(), userId, null], (analyticsErr) => {
        if (analyticsErr) {
          console.warn(`[Analytics] Advertencia: No se pudo crear registro de analytics para userId=${userId}:`, analyticsErr.message);
        } else {
          console.log(`[Analytics] ✅ Registro de analytics creado para userId=${userId}`);
        }

        const token = jwt.sign({ id: userId, email }, JWT_SECRET, { expiresIn: '30d' });

        res.status(201).json({ 
          message: 'Usuario registrado exitosamente', 
          userId,
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

/**
 * Solicita un código OTP para recuperar contraseña.
 * Genera un código de 6 dígitos, lo guarda en la BD con expiración de 15 min,
 * y lo envía al email del usuario via Resend.
 */
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email || !EMAIL_REGEX.test(email)) {
    return res.status(400).json({ error: 'Por favor ingresa un correo electrónico válido.' });
  }

  try {
    db.get(`SELECT id, name, email FROM users WHERE email = ?`, [email], async (err, user) => {
      if (err) {
        console.error('[forgotPassword] DB error:', err.message);
        return res.status(500).json({ error: 'Error interno del servidor.' });
      }

      // Respuesta genérica para no revelar si el email existe (seguridad)
      if (!user) {
        return res.json({ message: 'Si el correo está registrado, recibirás un código de verificación.' });
      }

      // Generar código OTP de 6 dígitos
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      const expiryDate = new Date(Date.now() + 15 * 60 * 1000).toISOString(); // 15 minutos

      db.run(
        `UPDATE users SET reset_token = ?, reset_token_expiry = ? WHERE id = ?`,
        [otpCode, expiryDate, user.id],
        async (updateErr) => {
          if (updateErr) {
            console.error('[forgotPassword] Error guardando token:', updateErr.message);
            return res.status(500).json({ error: 'Error interno del servidor.' });
          }

          try {
            await sendPasswordResetEmail(email, otpCode, user.name || 'estudiante');
            console.log(`[forgotPassword] OTP enviado a ${email} para userId=${user.id}`);
            res.json({ message: 'Si el correo está registrado, recibirás un código de verificación.' });
          } catch (emailErr) {
            console.error('[forgotPassword] Error enviando email:', emailErr.message);
            res.status(500).json({ error: 'No se pudo enviar el correo. Intenta de nuevo más tarde.' });
          }
        }
      );
    });
  } catch (error) {
    console.error('[forgotPassword] Error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};

/**
 * Verifica el código OTP y actualiza la contraseña del usuario.
 */
exports.resetPassword = async (req, res) => {
  const { email, code, newPassword } = req.body;

  if (!email || !code || !newPassword) {
    return res.status(400).json({ error: 'Faltan campos requeridos (email, code, newPassword).' });
  }

  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    db.get(
      `SELECT id, reset_token, reset_token_expiry FROM users WHERE email = ?`,
      [email],
      async (err, user) => {
        if (err) {
          console.error('[resetPassword] DB error:', err.message);
          return res.status(500).json({ error: 'Error interno del servidor.' });
        }

        if (!user || !user.reset_token) {
          return res.status(400).json({ error: 'Código inválido o expirado. Solicita uno nuevo.' });
        }

        // Verificar que el código no expiró
        const now = new Date();
        const expiry = new Date(user.reset_token_expiry);
        if (now > expiry) {
          return res.status(400).json({ error: 'El código ha expirado. Solicita uno nuevo.' });
        }

        // Verificar que el código coincide
        if (user.reset_token !== code.trim()) {
          return res.status(400).json({ error: 'El código ingresado no es correcto.' });
        }

        // Hashear la nueva contraseña y limpiar el token
        const passwordHash = await bcrypt.hash(newPassword, 10);

        db.run(
          `UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expiry = NULL WHERE id = ?`,
          [passwordHash, user.id],
          (updateErr) => {
            if (updateErr) {
              console.error('[resetPassword] Error actualizando contraseña:', updateErr.message);
              return res.status(500).json({ error: 'Error interno del servidor.' });
            }

            console.log(`[resetPassword] ✅ Contraseña restablecida para userId=${user.id}`);
            res.json({ message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión.' });
          }
        );
      }
    );
  } catch (error) {
    console.error('[resetPassword] Error:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud.' });
  }
};
