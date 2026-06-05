const bcrypt = require('bcrypt');
const { db } = require('../db');
const { getUniqueSharePin } = require('../utils/pinHelper');

/**
 * Obtener perfil de usuario por id
 */
exports.getUserProfile = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, email, name, lastname, username, major, university, semester, study_goal, created_at, last_login, share_pin, display_name, profile_image, active_grading_version_id, approval_threshold
    FROM users
    WHERE id = ?
  `;

  db.get(query, [userId], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }

    // Auto-generar share_pin para usuarios antiguos que no lo tienen
    if (!user.share_pin) {
      getUniqueSharePin().then(pin => {
        db.run('UPDATE users SET share_pin = ? WHERE id = ?', [pin, userId], (updateErr) => {
          if (!updateErr) {
            user.share_pin = pin;
          }
          res.json(user);
        });
      }).catch(err => {
        res.json(user);
      });
    } else {
      res.json(user);
    }
  });
};

/**
 * Actualizar perfil de usuario
 * Valida constraints y proporciona errores descriptivos
 */
exports.updateUserProfile = (req, res) => {
  const { userId } = req.params;
  const updates = [];
  const values = [];

  const fields = ['name', 'lastname', 'username', 'major', 'university', 'semester', 'study_goal', 'share_pin', 'display_name', 'profile_image', 'active_grading_version_id', 'approval_threshold'];
  
  // Validación de campos requeridos
  if (!userId) {
    return res.status(400).json({ error: 'userId inválido.' });
  }

  // Construir query dinámicamente con validaciones
  for (const field of fields) {
    if (req.body[field] !== undefined) {
      // Validar longitud de username
      if (field === 'username' && typeof req.body[field] === 'string') {
        if (req.body[field].length > 255) {
          return res.status(400).json({ error: 'El nombre de usuario no puede exceder 255 caracteres.' });
        }
        if (req.body[field].trim() === '') {
          return res.status(400).json({ error: 'El nombre de usuario no puede estar vacío.' });
        }
      }
      
      // Validar longitud y contenido de share_pin
      if (field === 'share_pin' && typeof req.body[field] === 'string') {
        if (req.body[field].length > 8) {
          return res.status(400).json({ error: 'El PIN no puede exceder 8 caracteres.' });
        }
        if (req.body[field].length > 0 && req.body[field].length < 4) {
          return res.status(400).json({ error: 'El PIN debe tener al menos 4 caracteres si se proporciona.' });
        }
      }
      
      // Validar approval_threshold
      if (field === 'approval_threshold' && typeof req.body[field] === 'number') {
        if (req.body[field] < 0 || req.body[field] > 100) {
          return res.status(400).json({ error: 'El umbral de aprobación debe estar entre 0 y 100.' });
        }
      }
      
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
  }

  values.push(userId);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) {
      // Manejar errores de constraint específicos
      const errorMsg = err.message || '';
      
      if (errorMsg.includes('UNIQUE constraint failed') || errorMsg.includes('unique') || err.code === '23505') {
        // Identificar qué campo violó el constraint
        if (errorMsg.includes('username')) {
          return res.status(409).json({ error: 'Este nombre de usuario ya está en uso.' });
        }
        if (errorMsg.includes('share_pin') || errorMsg.includes('PIN')) {
          return res.status(409).json({ error: 'Este PIN ya está en uso por otro usuario.' });
        }
        return res.status(409).json({ error: 'Este valor ya está en uso.' });
      }
      
      // Log del error para debugging
      console.error('[ERROR] updateUserProfile - SQL Error:', { 
        query, 
        values: values.slice(0, -1), // No loguear userId por seguridad
        errorMsg: err.message 
      });
      
      return res.status(500).json({ error: 'Error interno del servidor.' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    
    res.json({ message: 'Perfil actualizado exitosamente' });
  });
};

/**
 * Actualizar contraseña
 */
exports.updatePassword = async (req, res) => {
  const { userId } = req.params;
  const { currentPassword, newPassword } = req.body;
  
  db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    
    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    
    const passwordHash = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId], function(err) {
      if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
      res.json({ message: 'Contraseña actualizada exitosamente' });
    });
  });
};

/**
 * Verificar contraseña
 */
exports.verifyPassword = async (req, res) => {
  const { userId } = req.params;
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({ error: 'Se requiere contraseña' });
  }
  
  db.get('SELECT password_hash FROM users WHERE id = ?', [userId], async (err, user) => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) return res.status(401).json({ error: 'Contraseña incorrecta.' });
    
    res.json({ message: 'Contraseña verificada correctamente.' });
  });
};

/**
 * Obtener información de datos que se perderán
 */
exports.getDeletionDataCount = (req, res) => {
  const { userId } = req.params;
  
  const counts = {
    subjects: 0,
    recordings: 0,
    videos: 0,
    decks: 0,
    photos: 0,
  };

  db.get('SELECT COUNT(*) as count FROM subjects WHERE user_id = ?', [userId], (err, result) => {
    if (!err && result) counts.subjects = result.count;
    
    db.get('SELECT COUNT(*) as count FROM audio_recordings WHERE user_id = ?', [userId], (err, result) => {
      if (!err && result) counts.recordings = result.count;
      
      db.get('SELECT COUNT(*) as count FROM youtube_videos WHERE user_id = ?', [userId], (err, result) => {
        if (!err && result) counts.videos = result.count;
        
        db.get('SELECT COUNT(*) as count FROM flashcard_decks WHERE user_id = ?', [userId], (err, result) => {
          if (!err && result) counts.decks = result.count;
          
          db.get('SELECT COUNT(*) as count FROM gallery_items WHERE user_id = ?', [userId], (err, result) => {
            if (!err && result) counts.photos = result.count;
            
            res.json(counts);
          });
        });
      });
    });
  });
};

/**
 * Eliminar token biométrico
 */
exports.revokeBiometric = (req, res) => {
  const { userId } = req.params;
  db.run('UPDATE users SET biometric_token = NULL WHERE id = ?', [userId], function(err) {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    res.json({ message: 'Token biométrico revocado exitosamente' });
  });
};

/**
 * Solicitar eliminación (Soft Delete) - 14 días
 */
exports.requestDeletion = (req, res) => {
  const { userId } = req.params;
  
  db.get('SELECT id, status FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    if (user.status !== 'active') {
      return res.status(400).json({ error: 'La cuenta ya está marcada para eliminación o fue eliminada.' });
    }
    
    const deletionDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
    db.run(
      'UPDATE users SET status = ?, deletion_date = ? WHERE id = ?',
      ['pending_deletion', deletionDate.toISOString(), userId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error al procesar la solicitud de eliminación.' });
        
        res.json({ 
          message: 'Solicitud de eliminación registrada. Tu cuenta será eliminada en 14 días.',
          deletion_date: deletionDate.toISOString()
        });
      }
    );
  });
};

/**
 * Reactivar cuenta
 */
exports.reactivateAccount = (req, res) => {
  const { userId } = req.params;
  
  db.get('SELECT id, status, deletion_date FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });
    
    if (user.status !== 'pending_deletion') {
      return res.status(400).json({ error: 'La cuenta no está pendiente de eliminación.' });
    }
    
    const deletionDate = new Date(user.deletion_date);
    const now = new Date();
    if (now > deletionDate) {
      return res.status(400).json({ error: 'El período de 14 días ya ha expirado.' });
    }
    
    db.run(
      'UPDATE users SET status = ?, deletion_date = NULL WHERE id = ?',
      ['active', userId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Error al reactivar la cuenta.' });
        
        res.json({ message: 'Cuenta reactivada exitosamente.' });
      }
    );
  });
};
/**
 * Actualizar foto de perfil (URL de Firebase Storage)
 */
exports.updateProfileImage = (req, res) => {
  const { userId } = req.params;
  const { profile_image } = req.body;

  if (!profile_image) {
    return res.status(400).json({ error: 'Se requiere la URL de la imagen.' });
  }

  db.run('UPDATE users SET profile_image = ? WHERE id = ?', [profile_image, userId], function(err) {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
    res.json({ message: 'Foto de perfil actualizada exitosamente.', profile_image });
  });
};
