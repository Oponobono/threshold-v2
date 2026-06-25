const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');

/**
 * Crear un nuevo evento de calendario
 * POST /api/calendar/events
 * Body: {
 *   title: string (required)
 *   eventType: 'exam' | 'task' | 'class' | 'other' (required)
 *   subjectId?: number (required for exam/task/class)
 *   startDate: string (DD-MM-YYYY format, required)
 *   endDate: string (DD-MM-YYYY format, required)
 *   startTime?: string (HH:MM format, optional if all_day=true)
 *   endTime?: string (HH:MM format, optional if all_day=true)
 *   allDay: boolean (required)
 *   description?: string (optional)
 *   createStudyPlan: boolean (optional, only for exams)
 * }
 */
exports.createCalendarEvent = (req, res) => {
  const userId = req.user?.id || req.body.user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  const {
    id: clientId,
    title,
    eventType,
    subjectId,
    startDate,
    endDate,
    startTime,
    endTime,
    allDay,
    description,
    createStudyPlan,
  } = req.body;

  // Validación básica
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'El título del evento es requerido' });
  }

  if (!eventType || !['exam', 'task', 'class', 'other'].includes(eventType)) {
    return res.status(400).json({ error: 'Tipo de evento inválido' });
  }

  if (!startDate || !endDate) {
    return res.status(400).json({ error: 'Las fechas son requeridas' });
  }

  // Para eventos académicos (task, class) la materia es obligatoria.
  // 'exam' se permite sin materia para soportar mazos sin subject_id (<- subject optional en FlashcardNewDeckScreen).
  if (eventType !== 'other' && eventType !== 'exam' && !subjectId) {
    return res.status(400).json({ error: 'Se requiere una materia para este tipo de evento' });
  }

  // Si subjectId existe, verificar que pertenezca al usuario
  const checkSubjectQuery = subjectId
    ? `SELECT id FROM subjects WHERE id = ? AND user_id = ?`
    : null;

  const insertEventQuery = `
    INSERT INTO calendar_events (
      id,
      user_id,
      subject_id,
      title,
      event_type,
      description,
      start_date,
      end_date,
      start_time,
      end_time,
      all_day,
      create_study_plan,
      created_at,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `;

  // Si hay subjectId, primero verificar que pertenezca al usuario
  if (subjectId) {
    db.get(checkSubjectQuery, [subjectId, userId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar materia' });
      }

      if (!row) {
        return res.status(403).json({ error: 'La materia no existe o no pertenece al usuario' });
      }

      // Proceder a insertar el evento
      insertEvent();
    });
  } else {
    // Sin subjectId, insertar directamente
    insertEvent();
  }

  function insertEvent() {
    const eventId = clientId || uuidv4();
    db.run(
      insertEventQuery,
      [
        eventId,
        userId,
        subjectId || null,
        title.trim(),
        eventType,
        description || null,
        startDate, // DD-MM-YYYY
        endDate,   // DD-MM-YYYY
        startTime || null, // HH:MM o null
        endTime || null,   // HH:MM o null
        allDay ? 1 : 0,
        createStudyPlan ? 1 : 0,
      ],
      function (err) {
        if (err) {
          console.error('Error creando evento:', err);
          return res.status(500).json({ error: 'Error al crear el evento' });
        }

        // Si es un evento de examen y se solicita crear plan de estudio,
        // aquí se podría llamar a la lógica de generación de plan de estudio
        // Por ahora, solo retornamos el evento creado

        // Retornar el evento creado
        db.get(
          `SELECT * FROM calendar_events WHERE id = ?`,
          [eventId],
          (err, event) => {
            if (err) {
              return res.status(500).json({ error: 'Error al recuperar evento creado' });
            }

            res.status(201).json({
              id: event.id,
              title: event.title,
              eventType: event.event_type,
              subjectId: event.subject_id,
              startDate: event.start_date,
              endDate: event.end_date,
              startTime: event.start_time,
              endTime: event.end_time,
              allDay: event.all_day === 1,
              description: event.description,
              createStudyPlan: event.create_study_plan === 1,
              createdAt: event.created_at,
            });
          }
        );
      }
    );
  }
};

/**
 * Obtener eventos de calendario de un usuario
 * GET /api/calendar/events?user_id=X&startDate=DD-MM-YYYY&endDate=DD-MM-YYYY
 */
exports.getUserCalendarEvents = (req, res) => {
  const userId = req.user?.id || req.query.user_id;
  const { startDate, endDate } = req.query;

  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  let query = `
    SELECT 
      ce.*,
      s.name as subject_name,
      s.color as subject_color
    FROM calendar_events ce
    LEFT JOIN subjects s ON ce.subject_id = s.id
    WHERE ce.user_id = ?
  `;

  const params = [userId];

  // Opcional: filtrar por rango de fechas
  if (startDate && endDate) {
    // Asumir que startDate y endDate están en DD-MM-YYYY
    // Comparación simple: si las fechas se almacenan como strings en formato DD-MM-YYYY
    // la comparación lexicográfica debería funcionar correctamente
    query += ` AND ce.start_date >= ? AND ce.end_date <= ?`;
    params.push(startDate, endDate);
  }

  query += ` ORDER BY ce.start_date ASC`;

  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Error obteniendo eventos:', err);
      return res.status(500).json({ error: 'Error al obtener eventos' });
    }

    const events = rows.map(row => ({
      id: row.id,
      title: row.title,
      eventType: row.event_type,
      subjectId: row.subject_id,
      subjectName: row.subject_name,
      subjectColor: row.subject_color,
      startDate: row.start_date,
      endDate: row.end_date,
      startTime: row.start_time,
      endTime: row.end_time,
      allDay: row.all_day === 1,
      description: row.description,
      createStudyPlan: row.create_study_plan === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.json(events);
  });
};

/**
 * Obtener un evento específico
 * GET /api/calendar/events/:eventId
 */
exports.getCalendarEvent = (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.id || req.query.user_id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  db.get(
    `
    SELECT 
      ce.*,
      s.name as subject_name,
      s.color as subject_color
    FROM calendar_events ce
    LEFT JOIN subjects s ON ce.subject_id = s.id
    WHERE ce.id = ? AND ce.user_id = ?
    `,
    [eventId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al obtener evento' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }

      res.json({
        id: row.id,
        title: row.title,
        eventType: row.event_type,
        subjectId: row.subject_id,
        subjectName: row.subject_name,
        subjectColor: row.subject_color,
        startDate: row.start_date,
        endDate: row.end_date,
        startTime: row.start_time,
        endTime: row.end_time,
        allDay: row.all_day === 1,
        description: row.description,
        createStudyPlan: row.create_study_plan === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      });
    }
  );
};

/**
 * Actualizar un evento de calendario
 * PUT /api/calendar/events/:eventId
 */
exports.updateCalendarEvent = (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.id || req.body.user_id;
  
  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  const {
    title,
    eventType,
    subjectId,
    startDate,
    endDate,
    startTime,
    endTime,
    allDay,
    description,
    createStudyPlan,
  } = req.body;

  // Verificar que el evento pertenezca al usuario
  db.get(
    `SELECT id FROM calendar_events WHERE id = ? AND user_id = ?`,
    [eventId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar evento' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }

      // Si hay subjectId, verificar que pertenezca al usuario
      if (subjectId) {
        db.get(
          `SELECT id FROM subjects WHERE id = ? AND user_id = ?`,
          [subjectId, userId],
          (err, subjectRow) => {
            if (err) {
              return res.status(500).json({ error: 'Error al verificar materia' });
            }

            if (!subjectRow) {
              return res.status(403).json({ error: 'La materia no existe o no pertenece al usuario' });
            }

            updateEvent();
          }
        );
      } else {
        updateEvent();
      }
    }
  );

  function updateEvent() {
    const updates = [];
    const values = [];

    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title.trim());
    }
    if (eventType !== undefined) {
      updates.push('event_type = ?');
      values.push(eventType);
    }
    if (subjectId !== undefined) {
      updates.push('subject_id = ?');
      values.push(subjectId || null);
    }
    if (startDate !== undefined) {
      updates.push('start_date = ?');
      values.push(startDate);
    }
    if (endDate !== undefined) {
      updates.push('end_date = ?');
      values.push(endDate);
    }
    if (startTime !== undefined) {
      updates.push('start_time = ?');
      values.push(startTime || null);
    }
    if (endTime !== undefined) {
      updates.push('end_time = ?');
      values.push(endTime || null);
    }
    if (allDay !== undefined) {
      updates.push('all_day = ?');
      values.push(allDay ? 1 : 0);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description || null);
    }
    if (createStudyPlan !== undefined) {
      updates.push('create_study_plan = ?');
      values.push(createStudyPlan ? 1 : 0);
    }

    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 1) {
      // Solo se actualizó el timestamp
      return res.json({ id: eventId, message: 'No hay cambios' });
    }

    values.push(eventId, userId);

    const query = `UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ? AND user_id = ?`;

    db.run(query, values, function (err) {
      if (err) {
        console.error('Error actualizando evento:', err);
        return res.status(500).json({ error: 'Error al actualizar evento' });
      }

      // Retornar el evento actualizado
      db.get(
        `SELECT * FROM calendar_events WHERE id = ?`,
        [eventId],
        (err, event) => {
          if (err) {
            return res.status(500).json({ error: 'Error al recuperar evento actualizado' });
          }

          res.json({
            id: event.id,
            title: event.title,
            eventType: event.event_type,
            subjectId: event.subject_id,
            startDate: event.start_date,
            endDate: event.end_date,
            startTime: event.start_time,
            endTime: event.end_time,
            allDay: event.all_day === 1,
            description: event.description,
            createStudyPlan: event.create_study_plan === 1,
            createdAt: event.created_at,
            updatedAt: event.updated_at,
          });
        }
      );
    });
  }
};

/**
 * Eliminar un evento de calendario
 * DELETE /api/calendar/events/:eventId
 */
exports.deleteCalendarEvent = (req, res) => {
  const { eventId } = req.params;
  const userId = req.user?.id || req.query.user_id;

  if (!userId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  // Verificar que el evento pertenezca al usuario antes de eliminar
  db.get(
    `SELECT id FROM calendar_events WHERE id = ? AND user_id = ?`,
    [eventId, userId],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Error al verificar evento' });
      }

      if (!row) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }

      db.run(
        `DELETE FROM calendar_events WHERE id = ? AND user_id = ?`,
        [eventId, userId],
        function (err) {
          if (err) {
            console.error('Error eliminando evento:', err);
            return res.status(500).json({ error: 'Error al eliminar evento' });
          }

          res.json({ id: eventId, message: 'Evento eliminado exitosamente' });
        }
      );
    }
  );
};
