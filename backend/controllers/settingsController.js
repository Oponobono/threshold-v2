const { db } = require('../db');

exports.getGradingPeriods = (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT * FROM grading_periods WHERE user_id = ? ORDER BY start_date DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ periods: rows || [] });
    }
  );
};

exports.createGradingPeriod = (req, res) => {
  const userId = req.user.id;
  const { name, period_type, start_date, end_date } = req.body;
  if (!name || !period_type) {
    return res.status(400).json({ error: 'name y period_type son requeridos' });
  }
  db.run(
    `INSERT INTO grading_periods (user_id, name, period_type, start_date, end_date)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, name, period_type || 'custom', start_date || null, end_date || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, period_type });
    }
  );
};

exports.deleteGradingPeriod = (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  db.run(
    `DELETE FROM grading_periods WHERE id = ? AND user_id = ?`,
    [id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Período no encontrado' });
      res.json({ message: 'Período eliminado' });
    }
  );
};

exports.getThresholdOverrides = (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT sto.*, s.name as subject_name, s.color as subject_color
     FROM subject_threshold_overrides sto
     JOIN subjects s ON s.id = sto.subject_id
     WHERE sto.user_id = ?`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ overrides: rows || [] });
    }
  );
};

exports.saveThresholdOverrides = (req, res) => {
  const userId = req.user.id;
  const { overrides } = req.body;
  if (!Array.isArray(overrides)) {
    return res.status(400).json({ error: 'overrides debe ser un array' });
  }
  db.serialize(() => {
    db.run(`DELETE FROM subject_threshold_overrides WHERE user_id = ?`, [userId]);
    let completed = 0;
    const total = overrides.length;
    if (total === 0) return res.json({ message: 'Excepciones guardadas' });
    for (const o of overrides) {
      db.run(
        `INSERT INTO subject_threshold_overrides (user_id, subject_id, threshold)
         VALUES (?, ?, ?)
         ON CONFLICT(user_id, subject_id) DO UPDATE SET threshold = excluded.threshold`,
        [userId, o.subjectId, o.threshold],
        (err) => {
          if (err) console.error('Error saving override:', err.message);
          completed++;
          if (completed === total) {
            res.json({ message: 'Excepciones guardadas' });
          }
        }
      );
    }
  });
};

exports.createCustomGradingSystem = async (req, res) => {
  const userId = req.user.id;
  const { name, code, min_value, max_value, passing_value, precision, type, mode, direction } = req.body;
  if (!name || min_value == null || max_value == null || passing_value == null) {
    return res.status(400).json({ error: 'name, min_value, max_value y passing_value son requeridos' });
  }
  const systemCode = code || `CUSTOM_${Date.now()}`;
  db.run(
    `INSERT INTO grading_systems (code, name, type, mode, direction, country_code, is_system_seeded, is_custom, created_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [systemCode, name, type || 'numeric', mode || 'continuous', direction || 'ascending', null, false, true, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      const systemId = this.lastID;
      db.run(
        `INSERT INTO grading_versions (grading_system_id, owner_type, owner_id, min_value, max_value, passing_value, precision, is_active)
         VALUES (?, 'user', ?, ?, ?, ?, ?, ?)`,
        [systemId, String(userId), min_value, max_value, passing_value, precision || 2, true],
        function (err) {
          if (err) return res.status(500).json({ error: err.message });
          const versionId = this.lastID;
          const scales = [
            { label: 'Aprobado', min: passing_value, max: max_value, sort_order: 1, is_passing: 1, gpa_equivalent: 3.0, color: '#4CAF50' },
            { label: 'Reprobado', min: min_value, max: Math.max(min_value, passing_value - 0.01), sort_order: 2, is_passing: 0, gpa_equivalent: 0.0, color: '#F44336' },
          ];
          let scaleCount = 0;
          for (const s of scales) {
            db.run(
              `INSERT INTO grading_scales (grading_version_id, min_score, max_score, label, gpa_equivalent, color, sort_order, is_passing)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [versionId, s.min, s.max, s.label, s.gpa_equivalent, s.color, s.sort_order, s.is_passing],
              (err) => {
                if (err) console.error('Error creating scale:', err.message);
                scaleCount++;
                if (scaleCount === scales.length) {
                  res.status(201).json({
                    id: systemId,
                    code: systemCode,
                    name,
                    active_version_id: versionId,
                    min_value,
                    max_value,
                    passing_value,
                    is_custom: 1,
                  });
                }
              }
            );
          }
        }
      );
    }
  );
};

exports.getTwoFactorStatus = (req, res) => {
  const userId = req.user.id;
  db.get(
    `SELECT enabled FROM two_factor_auth WHERE user_id = ?`,
    [userId],
    (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ enabled: row ? row.enabled === 1 : false });
    }
  );
};

exports.enableTwoFactor = (req, res) => {
  const userId = req.user.id;
  const secret = `2fa_${userId}_${Date.now()}`;
  db.run(
    `INSERT INTO two_factor_auth (user_id, enabled, secret, updated_at)
     VALUES (?, 1, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET enabled = 1, secret = ?, updated_at = CURRENT_TIMESTAMP`,
    [userId, secret, secret],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ enabled: true, secret });
    }
  );
};

exports.disableTwoFactor = (req, res) => {
  const userId = req.user.id;
  db.run(
    `INSERT INTO two_factor_auth (user_id, enabled, updated_at)
     VALUES (?, 0, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id) DO UPDATE SET enabled = 0, secret = NULL, updated_at = CURRENT_TIMESTAMP`,
    [userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ enabled: false });
    }
  );
};

exports.getLmsAccounts = (req, res) => {
  const userId = req.user.id;
  db.all(
    `SELECT * FROM lms_accounts WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ accounts: rows || [] });
    }
  );
};

exports.addLmsAccount = (req, res) => {
  const userId = req.user.id;
  const { platform, instance_url, username } = req.body;
  if (!platform || !instance_url || !username) {
    return res.status(400).json({ error: 'platform, instance_url y username son requeridos' });
  }
  db.run(
    `INSERT INTO lms_accounts (user_id, platform, instance_url, username) VALUES (?, ?, ?, ?)`,
    [userId, platform, instance_url, username],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, platform, instance_url, username });
    }
  );
};

exports.removeLmsAccount = (req, res) => {
  const userId = req.user.id;
  const { id } = req.params;
  db.run(
    `DELETE FROM lms_accounts WHERE id = ? AND user_id = ?`,
    [id, userId],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Cuenta LMS no encontrada' });
      res.json({ message: 'Cuenta LMS desvinculada' });
    }
  );
};

exports.exportDataCsv = (req, res) => {
  const userId = req.user.id;
  Promise.all([
    new Promise((resolve) => db.all('SELECT * FROM subjects WHERE user_id = ?', [userId], (e, r) => resolve(r || []))),
    new Promise((resolve) => db.all('SELECT * FROM assessments WHERE user_id = ?', [userId], (e, r) => resolve(r || []))),
    new Promise((resolve) => db.all('SELECT * FROM flashcard_decks WHERE user_id = ?', [userId], (e, r) => resolve(r || []))),
    new Promise((resolve) => db.all('SELECT * FROM gallery_items WHERE user_id = ?', [userId], (e, r) => resolve(r || []))),
  ]).then(([subjects, assessments, decks, photos]) => {
    let csv = 'SECTION,ID,NAME,DETAILS\n';
    csv += subjects.map((s) => `Subject,${s.id},${s.name || ''},credits:${s.credits || ''}`).join('\n') + '\n';
    csv += assessments.map((a) => `Assessment,${a.id},${a.name || ''},grade:${a.grade_value || ''},completed:${a.is_completed}`).join('\n') + '\n';
    csv += decks.map((d) => `Deck,${d.id},${d.title || ''},cards:${d.total_reviews || ''}`).join('\n') + '\n';
    csv += photos.map((p) => `Photo,${p.id},${p.uri || ''},favorite:${p.is_starred || 0}`).join('\n') + '\n';
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="threshold_export_${userId}.csv"`);
    res.send(csv);
  }).catch((err) => res.status(500).json({ error: err.message }));
};

exports.exportDataPdf = (req, res) => {
  const userId = req.user.id;
  try {
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 30 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="threshold_export_${userId}.pdf"`);
    doc.pipe(res);
    doc.fontSize(20).text('Threshold - Exportación de datos', { align: 'center' });
    doc.moveDown(2);
    db.all('SELECT * FROM subjects WHERE user_id = ?', [userId], (err, subjects) => {
      if (err) return res.status(500).json({ error: err.message });
      doc.fontSize(14).text(`Materias (${subjects.length})`, { underline: true });
      doc.moveDown(0.5);
      for (const s of subjects) {
        doc.fontSize(10).text(`• ${s.name || 'Sin nombre'} | Créditos: ${s.credits || 'N/A'}`);
      }
      doc.moveDown(1.5);
      db.all('SELECT a.*, s.name as subject_name FROM assessments a JOIN subjects s ON s.id = a.subject_id WHERE a.user_id = ?', [userId], (err2, assessments) => {
        if (!err2) {
          doc.fontSize(14).text(`Evaluaciones (${assessments.length})`, { underline: true });
          doc.moveDown(0.5);
          for (const a of assessments) {
            doc.fontSize(10).text(`• ${a.name || 'Sin nombre'} (${a.subject_name}) - Nota: ${a.grade_value || 'N/A'} - ${a.is_completed ? 'Completada' : 'Pendiente'}`);
          }
        }
        doc.moveDown(2);
        doc.fontSize(10).fillColor('#888').text(`Exportado el ${new Date().toLocaleDateString()} por usuario ${userId}`, { align: 'center' });
        doc.end();
      });
    });
  } catch (err) {
    res.status(500).json({ error: 'Error generando PDF: ' + err.message });
  }
};

exports.sendFeedback = (req, res) => {
  const userId = req.user.id;
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'El mensaje es requerido' });
  }
  db.run(
    `INSERT INTO feedback_messages (user_id, message) VALUES (?, ?)`,
    [userId, message.trim()],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      console.log(`[Feedback] Usuario ${userId}: ${message.trim().substring(0, 100)}`);
      res.status(201).json({ message: 'Gracias por tu comentario' });
    }
  );
};
