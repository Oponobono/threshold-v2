const bcrypt = require('bcrypt');
const { db } = require('../db');
const { getUniqueSharePin } = require('../utils/pinHelper');

/**
 * Obtener perfil de usuario por id
 */
exports.getUserProfile = (req, res) => {
  const { userId } = req.params;
  const query = `
    SELECT id, email, name, lastname, username, grading_scale, approval_threshold, major, university, created_at, last_login, share_pin, display_name
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
 */
exports.updateUserProfile = (req, res) => {
  const { userId } = req.params;
  const updates = [];
  const values = [];

  const fields = ['name', 'lastname', 'username', 'university', 'share_pin', 'display_name'];
  
  fields.forEach(field => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No se enviaron campos para actualizar.' });
  }

  values.push(userId);
  const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;

  db.run(query, values, function(err) {
    if (err) return res.status(500).json({ error: 'Error interno del servidor.' });
    if (this.changes === 0) return res.status(404).json({ error: 'Usuario no encontrado.' });
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
