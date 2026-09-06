import type { Request, Response } from 'express';
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db');
const { incrementSyncVersion, incrementSyncCounterOnly, recordDeletion } = require('../helpers/syncVersion');

interface AuthRequest extends Request {
  user: {
    id: string;
  };
}

interface CreateScheduleDTO {
  id?: string;
  subject_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

/**
 * Predecir materia actual por horario
 */
exports.getCurrentSubjectPrediction = (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const now = new Date();

  // En JS getDay() es 0=Dom, ..., 6=Sáb.
  // En nuestra DB usamos 1=Lun, ..., 7=Dom.
  let dayOfWeek = now.getDay();
  if (dayOfWeek === 0) dayOfWeek = 7;

  const hours = now.getHours().toString().padStart(2, '0');
  const minutes = now.getMinutes().toString().padStart(2, '0');
  const currentTime = `${hours}:${minutes}`;

  const query = `
    SELECT s.subject_id as id, sub.name, sub.icon, sub.color
    FROM schedules s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE sub.user_id = ? 
      AND s.day_of_week = ? 
      AND ? BETWEEN s.start_time AND s.end_time
    ORDER BY s.start_time ASC
    LIMIT 1
  `;

  db.get(query, [userId, dayOfWeek, currentTime], (err: Error | null, row: unknown) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
};

/**
 * Obtener todos los horarios de hoy para un usuario
 */
exports.getTodaySchedules = (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const now = new Date();
  let dayOfWeek = now.getDay();
  if (dayOfWeek === 0) dayOfWeek = 7;

  const query = `
    SELECT s.id, s.subject_id, s.start_time, s.end_time, sub.name, sub.icon, sub.color
    FROM schedules s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE sub.user_id = ? AND s.day_of_week = ?
    ORDER BY s.start_time ASC
  `;

  db.all(query, [userId, dayOfWeek], (err: Error | null, rows: unknown[]) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Agregar un horario a una materia
 */
exports.createSchedule = (req: AuthRequest, res: Response) => {
  const { id: clientId, subject_id, day_of_week, start_time, end_time } = req.body as CreateScheduleDTO;
  if (!subject_id || !day_of_week || !start_time || !end_time) {
    return res.status(400).json({ error: 'Faltan campos requeridos.' });
  }

  const scheduleId = clientId || uuidv4();
  const userId = req.user.id;
  const query = `INSERT INTO schedules (id, user_id, subject_id, day_of_week, start_time, end_time) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET subject_id = excluded.subject_id, day_of_week = excluded.day_of_week, start_time = excluded.start_time, end_time = excluded.end_time`;
  
  db.run(query, [scheduleId, userId, subject_id, day_of_week, start_time, end_time], function(this: any, err: Error | null) {
    if (err) return res.status(500).json({ error: err.message });
    incrementSyncVersion('schedules', scheduleId, () => {
      res.status(201).json({ id: scheduleId, message: 'Horario agregado' });
    });
  });
};

/**
 * Eliminar un horario
 */
exports.deleteSchedule = (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const userId = req.user.id;
  
  db.run(`DELETE FROM schedules WHERE id = ? AND user_id = ?`, [id, userId], function(this: any, err: Error | null) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found or access denied' });
    recordDeletion('schedules', id, userId, () => {
      incrementSyncCounterOnly(() => {
        res.json({ message: 'Horario eliminado' });
      });
    });
  });
};

/**
 * Obtener horarios por materia
 */
exports.getSchedulesBySubject = (req: AuthRequest, res: Response) => {
  const { subjectId } = req.params;
  db.all(`SELECT * FROM schedules WHERE subject_id = ? ORDER BY day_of_week, start_time`, [subjectId], (err: Error | null, rows: unknown[]) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};

/**
 * Obtener todos los horarios semanales de un usuario
 */
exports.getSchedulesByUser = (req: AuthRequest, res: Response) => {
  const { userId } = req.params;
  const query = `
    SELECT s.id, s.subject_id, s.day_of_week, s.start_time, s.end_time, sub.name, sub.icon, sub.color
    FROM schedules s
    JOIN subjects sub ON s.subject_id = sub.id
    WHERE sub.user_id = ?
    ORDER BY s.day_of_week, s.start_time ASC
  `;

  db.all(query, [userId], (err: Error | null, rows: unknown[]) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
};
