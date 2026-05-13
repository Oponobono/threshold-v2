const { db } = require('../db');
const learningAnalytics = require('../utils/learningAnalytics');

/**
 * Registra o actualiza la visita de un dispositivo invitado
 */
exports.trackGuest = (req, res) => {
  const { device_id } = req.body;
  if (!device_id) return res.status(400).json({ error: 'Se requiere el device_id' });

  db.run(
    `INSERT INTO app_visitors (device_id, first_seen_at, last_visit_at, visit_count)
     VALUES (?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1)
     ON CONFLICT(device_id) DO UPDATE SET
       last_visit_at = CURRENT_TIMESTAMP,
       visit_count = visit_count + 1`,
    [device_id],
    function (err) {
      if (err) return res.status(500).json({ error: 'Error registrando la visita.' });
      res.json({ message: 'Visita registrada correctamente.' });
    }
  );
};

// GET /api/analytics/mastery/:userId/:subjectId
exports.getMastery = (req, res) => {
  const { userId, subjectId } = req.params;

  let query = `
    SELECT la.*, s.name as subject_name
    FROM learning_analytics la
    LEFT JOIN subjects s ON la.subject_id = s.id
    WHERE la.user_id = ?
  `;
  const params = [userId];

  if (subjectId !== 'all') {
    query += ` AND la.subject_id = ?`;
    params.push(subjectId);
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const masteryData = learningAnalytics.createDomainMap(
      rows.map(row => ({
        subject_id: row.subject_id,
        subject_name: row.subject_name || 'General',
        mastery_percentage: row.mastery_percentage || 0,
      }))
    );
    res.json(masteryData);
  });
};

// GET /api/analytics/predictions/:userId
exports.getReviewPredictions = (req, res) => {
  const { userId } = req.params;

  db.all(
    `SELECT fc.*, la.mastery_percentage, fd.subject_id
     FROM flashcards fc
     JOIN flashcard_decks fd ON fc.deck_id = fd.id
     LEFT JOIN learning_analytics la ON fd.subject_id = la.subject_id AND la.user_id = ?
     WHERE fc.next_review_date <= CURRENT_TIMESTAMP
     AND fd.user_id = ?
     ORDER BY fc.next_review_date ASC
     LIMIT 20`,
    [userId, userId],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      const predictions = rows.map(card => ({
        cardId: card.id,
        question: card.front,
        subjectId: card.subject_id,
        mastery: card.mastery_percentage,
        urgency: (card.mastery_percentage || 0) < 50 ? 'HIGH' : 'MEDIUM',
      }));

      res.json({ dueCount: predictions.length, cards: predictions });
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// EXPORTACIÓN A PDF — Informe de Dominio del Estudiante
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/analytics/report/:userId
 *
 * Genera y devuelve un informe PDF con:
 *  - Portada con nombre del estudiante y fecha
 *  - Resumen global: mazos, tarjetas, tasa de dominio
 *  - Desglose por materia (learning_analytics)
 *  - Historial reciente de logs de estudio
 *  - Tarjetas pendientes de revisión (predicciones SM-2)
 */
exports.generateReport = async (req, res) => {
  const { userId } = req.params;

  try {
    // ── 1. Recolectar datos en paralelo ──────────────────────────────────────
    const [user, analytics, decks, recentLogs, predictions] = await Promise.all([
      new Promise((resolve) =>
        db.get(`SELECT name, lastname, username FROM users WHERE id = ?`, [userId], (err, row) => resolve(row || {}))
      ),
      new Promise((resolve) =>
        db.all(
          `SELECT la.mastery_percentage, s.name as subject_name, la.subject_id
           FROM learning_analytics la
           LEFT JOIN subjects s ON la.subject_id = s.id
           WHERE la.user_id = ?
           ORDER BY la.mastery_percentage DESC`,
          [userId], (err, rows) => resolve(rows || [])
        )
      ),
      new Promise((resolve) =>
        db.all(
          `SELECT fd.title,
                  COUNT(fc.id) as total_cards,
                  SUM(CASE WHEN fc.status = 'review' THEN 1 ELSE 0 END) as mastered,
                  SUM(CASE WHEN fc.status = 'learning' THEN 1 ELSE 0 END) as learning,
                  SUM(CASE WHEN fc.status = 'new' THEN 1 ELSE 0 END) as new_cards,
                  s.name as subject_name
           FROM flashcard_decks fd
           LEFT JOIN flashcards fc ON fc.deck_id = fd.id
           LEFT JOIN subjects s ON fd.subject_id = s.id
           WHERE fd.user_id = ?
           GROUP BY fd.id
           ORDER BY mastered DESC
           LIMIT 15`,
          [userId], (err, rows) => resolve(rows || [])
        )
      ),
      new Promise((resolve) =>
        db.all(
          `SELECT cl.result, cl.response_time_ms, cl.timestamp, fc.front
           FROM card_logs cl
           JOIN flashcards fc ON cl.card_id = fc.id
           WHERE cl.user_id = ?
           ORDER BY cl.timestamp DESC
           LIMIT 30`,
          [userId], (err, rows) => resolve(rows || [])
        )
      ),
      new Promise((resolve) =>
        db.all(
          `SELECT fc.front, fd.title as deck_title, fc.next_review_date
           FROM flashcards fc
           JOIN flashcard_decks fd ON fc.deck_id = fd.id
           WHERE fc.next_review_date <= CURRENT_TIMESTAMP AND fd.user_id = ?
           ORDER BY fc.next_review_date ASC
           LIMIT 10`,
          [userId], (err, rows) => resolve(rows || [])
        )
      ),
    ]);

    // ── 2. Calcular métricas globales ────────────────────────────────────────
    const totalCards = decks.reduce((s, d) => s + (d.total_cards || 0), 0);
    const mastered   = decks.reduce((s, d) => s + (d.mastered || 0), 0);
    const inProgress = decks.reduce((s, d) => s + (d.learning || 0), 0);
    const notStarted = decks.reduce((s, d) => s + (d.new_cards || 0), 0);
    const domainPct  = totalCards > 0 ? Math.round((mastered / totalCards) * 100) : 0;
    const avgMastery = analytics.length > 0
      ? Math.round(analytics.reduce((s, a) => s + (a.mastery_percentage || 0), 0) / analytics.length)
      : 0;
    const correctLogs = recentLogs.filter(l => l.result === 'review').length;
    const accuracy    = recentLogs.length > 0 ? Math.round((correctLogs / recentLogs.length) * 100) : 0;

    const displayName = [user.name, user.lastname].filter(Boolean).join(' ') || user.username || `Usuario #${userId}`;
    const dateStr = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

    // ── 3. Construir el PDF ──────────────────────────────────────────────────
    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="informe_dominio_${userId}.pdf"`);
    doc.pipe(res);

    const C = {
      primary:   '#5A7BFF',
      dark:      '#1A1A2E',
      gray:      '#666666',
      lightGray: '#F5F5F5',
      green:     '#2E7D32',
      orange:    '#E65100',
      red:       '#C62828',
      white:     '#FFFFFF',
      amber:     '#FFF8E1',
    };
    const pageW = doc.page.width - 100;

    // ── PORTADA ──────────────────────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 180).fill(C.primary);
    doc.fillColor(C.white).fontSize(28).font('Helvetica-Bold')
       .text('Informe de Dominio', 50, 50, { width: pageW });
    doc.fontSize(14).font('Helvetica')
       .text('Sistema de Aprendizaje · Threshold', 50, 90, { width: pageW });
    doc.fontSize(11)
       .text(`Estudiante: ${displayName}`, 50, 120, { width: pageW })
       .text(`Generado el: ${dateStr}`, 50, 140, { width: pageW });

    // ── RESUMEN GLOBAL ───────────────────────────────────────────────────────
    doc.moveDown(4).fillColor(C.dark);
    doc.fontSize(16).font('Helvetica-Bold').text('Resumen Global');
    doc.moveDown(0.5);

    const drawBox = (label, value, color, x, y, w = 110) => {
      doc.roundedRect(x, y, w, 64, 8).fill(C.lightGray);
      doc.fillColor(color).fontSize(22).font('Helvetica-Bold').text(value, x, y + 10, { width: w, align: 'center' });
      doc.fillColor(C.gray).fontSize(9).font('Helvetica').text(label, x, y + 40, { width: w, align: 'center' });
    };

    const statY = doc.y;
    drawBox('Tarjetas Totales',   totalCards.toString(),  C.primary, 50,  statY);
    drawBox('Dominadas',          mastered.toString(),    C.green,   175, statY);
    drawBox('En Progreso',        inProgress.toString(),  C.orange,  300, statY);
    drawBox('Sin Iniciar',        notStarted.toString(),  C.gray,    425, statY);
    doc.y = statY + 80;
    drawBox('Dominio Global',     `${domainPct}%`,        C.primary, 50,  doc.y, 140);
    drawBox('Maestría Promedio',  `${avgMastery}%`,       C.green,   210, doc.y, 140);
    drawBox('Precisión (30 últ.)',`${accuracy}%`,         C.orange,  370, doc.y, 140);
    doc.y += 80;
    doc.moveDown(1);

    // ── DESGLOSE POR MATERIA ─────────────────────────────────────────────────
    if (analytics.length > 0) {
      doc.addPage();
      doc.fillColor(C.dark).fontSize(16).font('Helvetica-Bold').text('Dominio por Materia');
      doc.moveDown(0.5);

      for (const subj of analytics) {
        const pct  = Math.min(100, Math.round(subj.mastery_percentage || 0));
        const barW = Math.round((pageW - 120) * pct / 100);
        const col  = pct >= 70 ? C.green : pct >= 40 ? C.orange : C.red;
        const rowY = doc.y;

        doc.fillColor(C.dark).fontSize(10).font('Helvetica-Bold')
           .text(subj.subject_name || 'Sin materia', 50, rowY, { width: 120 });
        doc.roundedRect(175, rowY + 2, pageW - 120, 14, 4).fill(C.lightGray);
        if (barW > 0) doc.roundedRect(175, rowY + 2, barW, 14, 4).fill(col);
        doc.fillColor(C.gray).fontSize(9).font('Helvetica')
           .text(`${pct}%`, pageW + 55, rowY, { width: 40, align: 'right' });

        doc.y = rowY + 22;
        if (doc.y > 750) doc.addPage();
      }
      doc.moveDown(1);
    }

    // ── TABLA DE MAZOS ───────────────────────────────────────────────────────
    if (decks.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fillColor(C.dark).fontSize(16).font('Helvetica-Bold').text('Mazos de Estudio');
      doc.moveDown(0.5);

      const tY = doc.y;
      doc.rect(50, tY, pageW, 20).fill(C.primary);
      doc.fillColor(C.white).fontSize(9).font('Helvetica-Bold')
         .text('Mazo',     55,  tY + 5, { width: 180 })
         .text('Materia', 240,  tY + 5, { width: 100 })
         .text('Total',   345,  tY + 5, { width: 50, align: 'center' })
         .text('Dom.',    400,  tY + 5, { width: 50, align: 'center' })
         .text('Prog.',   455,  tY + 5, { width: 50, align: 'center' })
         .text('Nuevo',   510,  tY + 5, { width: 50, align: 'center' });
      doc.y = tY + 22;

      decks.forEach((d, i) => {
        if (doc.y > 750) doc.addPage();
        const bg = i % 2 === 0 ? C.lightGray : C.white;
        const ry = doc.y;
        doc.rect(50, ry, pageW, 18).fill(bg);
        doc.fillColor(C.dark).fontSize(8).font('Helvetica')
           .text((d.title || '').substring(0, 28),          55,  ry + 4, { width: 180 })
           .text((d.subject_name || '-').substring(0, 18),  240, ry + 4, { width: 100 })
           .text((d.total_cards || 0).toString(),           345, ry + 4, { width: 50, align: 'center' })
           .text((d.mastered   || 0).toString(),            400, ry + 4, { width: 50, align: 'center' })
           .text((d.learning   || 0).toString(),            455, ry + 4, { width: 50, align: 'center' })
           .text((d.new_cards  || 0).toString(),            510, ry + 4, { width: 50, align: 'center' });
        doc.y = ry + 20;
      });
      doc.moveDown(1);
    }

    // ── PREDICCIONES SM-2 ────────────────────────────────────────────────────
    if (predictions.length > 0) {
      if (doc.y > 600) doc.addPage();
      doc.fillColor(C.dark).fontSize(16).font('Helvetica-Bold').text('Tarjetas Pendientes de Repaso (SM-2)');
      doc.moveDown(0.3);
      doc.fillColor(C.gray).fontSize(9).font('Helvetica')
         .text('Las siguientes tarjetas han superado su fecha óptima de revisión según el algoritmo SM-2.', { width: pageW });
      doc.moveDown(0.5);

      for (const p of predictions) {
        if (doc.y > 750) doc.addPage();
        const py = doc.y;
        doc.roundedRect(50, py, pageW, 30, 6).fill(C.amber);
        doc.fillColor(C.orange).fontSize(8).font('Helvetica-Bold')
           .text('PENDIENTE', 58, py + 5, { width: 65 });
        doc.fillColor(C.dark).fontSize(8).font('Helvetica')
           .text((p.front || '').substring(0, 85), 130, py + 5, { width: pageW - 130 })
           .text(`Mazo: ${p.deck_title || '-'}`,    130, py + 18, { width: pageW - 130 });
        doc.y = py + 36;
      }
    }

    // ── PIE DE PÁGINA ────────────────────────────────────────────────────────
    doc.fillColor(C.gray).fontSize(7)
       .text(
         `Threshold · Informe generado el ${dateStr} · ${displayName}`,
         50, doc.page.height - 40,
         { width: pageW, align: 'center' }
       );

    doc.end();

  } catch (err) {
    console.error('[generateReport] Error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error generando el informe PDF', details: err.message });
    }
  }
};
