const { db } = require('../db');

/**
 * Obtener sesiones de estudio de un usuario
 */
exports.getStudySessions = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM study_sessions WHERE user_id = ? ORDER BY start_timestamp DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Guardar una nueva sesión de estudio
 */
exports.createStudySession = (req, res) => {
  const { user_id, subject_id, session_type, config_value, duration_seconds, performance_rating } = req.body;
  
  if (!user_id || !session_type || duration_seconds === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos para la sesión de estudio.' });
  }

  const query = `
    INSERT INTO study_sessions (user_id, subject_id, session_type, config_value, duration_seconds, performance_rating)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.run(query, [user_id, subject_id || null, session_type, config_value || null, duration_seconds, performance_rating || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Sesión de estudio guardada.' });
  });
};

/**
 * Obtener logs de tarjetas de un usuario (analytics)
 */
exports.getCardLogs = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM card_logs WHERE user_id = ? ORDER BY timestamp DESC LIMIT 500`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Registrar un log de tarjeta (interacción de estudio)
 */
exports.createCardLog = (req, res) => {
  const { card_id, user_id, result, response_time_ms } = req.body;
  
  if (!card_id || !user_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (card_id, user_id).' });
  }

  const query = `
    INSERT INTO card_logs (card_id, user_id, result, response_time_ms)
    VALUES (?, ?, ?, ?)
  `;

  db.run(query, [card_id, user_id, result || null, response_time_ms || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Log de tarjeta guardado.' });
  });
};

/**
 * Obtener los grupos de un usuario
 */
exports.getGroups = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT * FROM group_memberships WHERE user_id = ? ORDER BY joined_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Unirse a un grupo mediante PIN
 */
exports.joinGroup = (req, res) => {
  const { user_id, group_pin_id } = req.body;
  
  if (!user_id || !group_pin_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  db.get(`SELECT id, username, name FROM users WHERE share_pin = ?`, [group_pin_id], (err, targetUser) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!targetUser) return res.status(404).json({ error: 'PIN de grupo no encontrado. Verifica e inténtalo de nuevo.' });
    if (targetUser.id === user_id) return res.status(400).json({ error: 'No puedes unirte a tu propia cuenta.' });

    db.get(`SELECT id FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`, [user_id, group_pin_id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row) return res.status(400).json({ error: 'Ya eres miembro de este grupo.' });

      const query = `
        INSERT INTO group_memberships (user_id, group_pin_id, role)
        VALUES (?, ?, 'member')
      `;

      db.run(query, [user_id, group_pin_id], function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });
        res.status(201).json({ id: this.lastID, message: `Te has unido exitosamente al grupo de ${targetUser.name || targetUser.username}.` });
      });
    });
  });
};

/**
 * Salir de un grupo
 */
exports.leaveGroup = (req, res) => {
  const { user_id, group_pin_id } = req.body;
  
  if (!user_id || !group_pin_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos (user_id, group_pin_id).' });
  }

  const query = `DELETE FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`;

  db.run(query, [user_id, group_pin_id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'No se encontró la membresía del grupo.' });
    res.json({ message: 'Has salido del grupo exitosamente.' });
  });
};
