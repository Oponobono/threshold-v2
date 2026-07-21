const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const bcrypt = require('bcrypt');
const { computeUserGPA } = require('./analyticsController');

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
  const { id: clientId, user_id, subject_id, session_type, config_value, duration_seconds, performance_rating } = req.body;
  
  if (!user_id || !session_type || duration_seconds === undefined) {
    return res.status(400).json({ error: 'Faltan campos requeridos para la sesión de estudio.' });
  }

  const sessionId = clientId || uuidv4();
  const query = `
    INSERT INTO study_sessions (id, user_id, subject_id, session_type, config_value, duration_seconds, performance_rating)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      subject_id = excluded.subject_id,
      session_type = excluded.session_type,
      config_value = excluded.config_value,
      duration_seconds = excluded.duration_seconds,
      performance_rating = excluded.performance_rating
  `;

  db.run(query, [sessionId, user_id, subject_id || null, session_type, config_value || null, duration_seconds, performance_rating || null], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: sessionId, message: 'Sesión de estudio guardada.' });
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

exports.createCardLog = async (req, res) => {
  try {
    const { id: clientId, card_id, user_id, subject_id, result, response_time_ms, question_word_count, difficulty_deduced } = req.body;
    
    if (!card_id || !user_id) {
      return res.status(400).json({ error: 'Faltan campos requeridos (card_id, user_id).' });
    }

    const currentCard = await new Promise((resolve, reject) => {
      db.get(`SELECT * FROM flashcards WHERE id = ?`, [card_id], (err, row) => {
        if (err) reject(err);
        resolve(row);
      });
    });

    if (!currentCard) {
      return res.status(404).json({ error: 'Tarjeta no encontrada' });
    }

    const isCorrect = result === 'correct' || result === true;
    const logId = clientId || uuidv4();
    const wordCount = question_word_count || currentCard.word_count || 20;
    const diffDeduced = difficulty_deduced || (isCorrect ? 'good' : 'forgotten');

    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO card_logs 
         (id, card_id, user_id, result, response_time_ms, 
          difficulty_deduced, normalized_time_ms, text_length_words)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          logId,
          card_id,
          user_id,
          isCorrect ? 'correct' : 'incorrect',
          response_time_ms || 0,
          diffDeduced,
          response_time_ms || 0,
          wordCount,
        ],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.status(201).json({
      success: true,
      logId: logId,
      message: 'Log de tarjeta persistido exitosamente (Local-First Sync).',
    });

  } catch (error) {
    console.error('[learningController.createCardLog] Error:', error);
    res.status(500).json({ error: 'Failed to process card log' });
  }
};

/**
 * Obtener los mazos compartidos dentro de un grupo específico
 */
exports.getGroupDecks = (req, res) => {
  const { groupPinId } = req.params;
  const userId = req.user?.id;

  if (!userId) return res.status(401).json({ error: 'No autenticado' });

  // Verificar que el usuario es miembro del grupo
  db.get(`SELECT id FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`,
    [userId, groupPinId],
    (err, membership) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!membership) return res.status(403).json({ error: 'No eres miembro de este grupo' });

      // Obtener todos los mazos de los miembros del grupo
      db.all(
        `SELECT fd.*, u.username as owner_username,
                s.name as subject_name, s.color as subject_color, s.icon as subject_icon
         FROM flashcard_decks fd
         JOIN users u ON fd.user_id = u.id
         LEFT JOIN subjects s ON fd.subject_id = s.id
         WHERE fd.user_id IN (
           SELECT user_id FROM group_memberships
           WHERE group_pin_id = ?
         )
         ORDER BY fd.title ASC`,
        [groupPinId],
        (err, rows) => {
          if (err) return res.status(500).json({ error: err.message });
          // Marcar los mazos del usuario actual como propios
          const result = (rows || []).map((deck) => ({
            ...deck,
            is_own: deck.user_id === userId,
          }));
          res.json(result);
        }
      );
    }
  );
};

/**
 * Obtener los grupos de un usuario (incluye nombre del grupo)
 */
exports.getGroups = (req, res) => {
  const { userId } = req.params;
  db.all(
    `SELECT gm.*, g.name, g.is_public
     FROM group_memberships gm
     LEFT JOIN groups g ON g.group_pin_id = gm.group_pin_id
     WHERE gm.user_id = ?
     ORDER BY gm.joined_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    }
  );
};

/**
 * Crea un nuevo grupo colaborativo
 */
exports.createGroup = (req, res) => {
  const { id: clientId, creator_user_id, group_pin_id, name, is_public, password } = req.body;

  if (!creator_user_id || !group_pin_id || !name) {
    return res.status(400).json({ error: 'Faltan campos requeridos (creator_user_id, group_pin_id, name).' });
  }

  // Verificar que el PIN no esté ya registrado en la tabla groups
  db.get(`SELECT id FROM groups WHERE group_pin_id = ?`, [group_pin_id], (err, existing) => {
    if (err) return res.status(500).json({ error: err.message });
    if (existing) return res.status(409).json({ error: 'El PIN del grupo ya está en uso.' });

    const isPublicVal = is_public !== false;
    const pwd = password ? bcrypt.hashSync(password, 10) : null;

    db.run(
      `INSERT INTO groups (group_pin_id, name, creator_user_id, is_public, password) VALUES (?, ?, ?, ?, ?)`,
      [group_pin_id, name, creator_user_id, isPublicVal, pwd],
      function(insertErr) {
        if (insertErr) return res.status(500).json({ error: insertErr.message });

        // Auto-inscribir al creador como miembro con rol 'creator'
        const membershipId = clientId || uuidv4();
        db.run(
          `INSERT INTO group_memberships (id, user_id, group_pin_id, role) VALUES (?, ?, ?, 'creator')`,
          [membershipId, creator_user_id, group_pin_id],
          function(memberErr) {
            if (memberErr) return res.status(500).json({ error: memberErr.message });
            res.status(201).json({
              id: membershipId,
              group_pin_id,
              name,
              message: 'Grupo creado exitosamente.',
            });
          }
        );
      }
    );
  });
};

/**
 * Unirse a un grupo mediante PIN
 */
exports.joinGroup = (req, res) => {
  const { id: clientId, user_id, group_pin_id, password } = req.body;
  
  if (!user_id || !group_pin_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  // Buscar el grupo por su PIN
  db.get(`SELECT * FROM groups WHERE group_pin_id = ?`, [group_pin_id], (err, group) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!group) return res.status(404).json({ error: 'PIN de grupo no encontrado. Verifica e inténtalo de nuevo.' });

    // Verificar contraseña si el grupo es privado
    if (!group.is_public) {
      if (!password) return res.status(400).json({ error: 'Este grupo es privado. Ingresa la contraseña.' });
      if (!bcrypt.compareSync(password, group.password)) return res.status(403).json({ error: 'Contraseña incorrecta.' });
    }

    // Verificar si ya es miembro
    db.get(`SELECT id FROM group_memberships WHERE user_id = ? AND group_pin_id = ?`, [user_id, group_pin_id], (err2, row) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (row) return res.status(400).json({ error: 'Ya eres miembro de este grupo.' });

      const membershipId = clientId || uuidv4();
      db.run(
        `INSERT INTO group_memberships (id, user_id, group_pin_id, role) VALUES (?, ?, ?, 'member')`,
        [membershipId, user_id, group_pin_id],
        function(insertErr) {
          if (insertErr) return res.status(500).json({ error: insertErr.message });
          res.status(201).json({
            id: membershipId,
            group_pin_id,
            name: group.name,
            message: `Te has unido exitosamente al grupo "${group.name}".`,
          });
        }
      );
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

/**
 * GET /learning/groups/:groupPinId/leaderboard
 * 
 * Obtiene el ranking de GPA de los miembros de un grupo.
 */
exports.getGroupLeaderboard = async (req, res) => {
  const { groupPinId } = req.params;

  if (!groupPinId) {
    return res.status(400).json({ error: 'Se requiere groupPinId' });
  }

  try {
    // Obtener todos los miembros del grupo
    db.all(
      `SELECT gm.user_id, u.username, u.display_name, u.profile_image
       FROM group_memberships gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_pin_id = ?`,
      [groupPinId],
      async (err, members) => {
        if (err) return res.status(500).json({ error: err.message });

        if (!members || members.length === 0) {
          return res.json({ leaderboard: [] });
        }

        try {
          const results = await Promise.all(
            members.map(async (member) => {
              const gpa = await computeUserGPA(member.user_id);
              return {
                userId: member.user_id,
                username: member.username,
                displayName: member.display_name,
                profileImage: member.profile_image,
                gpa: gpa.currentAverage,
                assessmentCount: gpa.assessmentCount,
                subjectCount: gpa.subjectCount,
              };
            })
          );

          results.sort((a, b) => b.gpa - a.gpa);
          res.json({ leaderboard: results });
        } catch (calcErr) {
          console.error(`[getGroupLeaderboard] Error al calcular GPA: ${calcErr.message}`);
          res.status(500).json({ error: `Error al calcular GPAs: ${calcErr.message}` });
        }
      }
    );
  } catch (err) {
    console.error(`[getGroupLeaderboard] Unexpected error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};
