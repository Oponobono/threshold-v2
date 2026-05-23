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
  const startTime = Date.now();
  const TIMEOUT = 30000; // 30 segundos timeout

  // Configurar timeout para prevenir que el request cuelgue
  const timeoutId = setTimeout(() => {
    console.error(`[getMastery] Request timeout para userId=${userId}, subjectId=${subjectId}`);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout al obtener analítica de dominio' });
    }
  }, TIMEOUT);

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
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (err) {
      console.error(`[getMastery] Error DB para userId=${userId}: ${err.message} (${duration}ms)`);
      return res.status(500).json({ error: `Database error: ${err.message}` });
    }

    if (!rows || rows.length === 0) {
      console.warn(`[getMastery] Sin datos para userId=${userId}, subjectId=${subjectId}`);
      return res.json([]);
    }

    try {
      const masteryData = learningAnalytics.createDomainMap(
        rows.map(row => ({
          subject_id: row.subject_id,
          subject_name: row.subject_name || 'General',
          mastery_percentage: row.mastery_percentage || 0,
        }))
      );
      console.log(`[getMastery] ✓ userId=${userId}, subjectId=${subjectId} (${duration}ms)`);
      res.json(masteryData);
    } catch (mapErr) {
      console.error(`[getMastery] Error al mapear datos: ${mapErr.message}`);
      res.status(500).json({ error: `Error processing mastery data: ${mapErr.message}` });
    }
  });
};

// GET /api/analytics/predictions/:userId
exports.getReviewPredictions = (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  // Primero: contar cuántos MAZOS tienen tarjetas vencidas (no el total de tarjetas).
  // Esto evita mostrar números grandes (ej: 30 tarjetas) cuando lo que importa
  // es cuántos mazos hay que repasar (ej: 3 mazos).
  // 
  // IMPORTANTE: Solo contar tarjetas que realmente necesitan repasar:
  // - status != 'review' (ej: 'new', 'learning', o cualquiera que no sea 'review'/'mastered')
  // - next_review_date es NOT NULL y es válido (para evitar NULL comparisons)
  // - next_review_date <= CURRENT_TIMESTAMP (vencidas)
  db.get(
    `SELECT COUNT(DISTINCT fc.deck_id) as due_deck_count
     FROM flashcards fc
     JOIN flashcard_decks fd ON fc.deck_id = fd.id
     WHERE fc.next_review_date IS NOT NULL
     AND fc.next_review_date <= CURRENT_TIMESTAMP
     AND fc.status IN ('new', 'learning')
     AND fd.user_id = ?`,
    [userId],
    (countErr, countRow) => {
      if (countErr) {
        console.error(`[Analytics] Error contando mazos vencidos para userId=${userId}:`, countErr);
        return res.status(500).json({ error: countErr.message });
      }

      const dueDeckCount = (countRow && countRow.due_deck_count) || 0;
      console.log(`[Analytics] Mazos con tarjetas vencidas para userId=${userId}: ${dueDeckCount}`);

      // Si no hay mazos con tarjetas vencidas, retornar inmediatamente
      if (dueDeckCount === 0) {
        return res.json({ dueCount: 0, deckCount: 0, cards: [] });
      }

      // Segundo: obtener una muestra representativa de las tarjetas más urgentes
      // (para uso futuro / detalle) — limitada para no saturar la respuesta.
      // Solo devolver tarjetas con status 'new' o 'learning' (no 'review'/'mastered')
      db.all(
        `SELECT
           fc.id,
           fc.front,
           fc.next_review_date,
           fd.id as deck_id,
           fd.title as deck_title,
           fd.subject_id,
           la.mastery_percentage,
           CASE
             WHEN COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) > 0
             THEN CAST(COALESCE(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END), 0) AS FLOAT) /
                  CAST(COALESCE(COUNT(cl.id), 1) AS FLOAT)
             ELSE 0
           END as failure_rate
         FROM flashcards fc
         JOIN flashcard_decks fd ON fc.deck_id = fd.id
         LEFT JOIN learning_analytics la ON fd.subject_id = la.subject_id AND la.user_id = ?
         LEFT JOIN card_logs cl ON fc.id = cl.card_id AND cl.user_id = ?
         WHERE fc.next_review_date IS NOT NULL
         AND fc.next_review_date <= CURRENT_TIMESTAMP
         AND fc.status IN ('new', 'learning')
         AND fd.user_id = ?
         GROUP BY fc.id, fc.front, fc.next_review_date, fd.id, fd.title, fd.subject_id, la.mastery_percentage
         ORDER BY
           la.mastery_percentage ASC,
           fc.next_review_date ASC,
           failure_rate DESC
         LIMIT 20`,
        [userId, userId, userId],
        (err, rows) => {
          if (err) {
            console.error(`[Analytics] Error en getReviewPredictions para userId=${userId}:`, err);
            return res.status(500).json({ error: err.message });
          }

          const predictions = (rows || []).map(card => ({
            cardId: card.id,
            question: card.front,
            deckId: card.deck_id,
            deckTitle: card.deck_title,
            subjectId: card.subject_id || 0,
            mastery: card.mastery_percentage || 0,
            urgency: (card.mastery_percentage || 0) < 50 ? 'HIGH' : 'MEDIUM',
            failureRate: Math.round(card.failure_rate * 100),
          }));

          // dueCount = número de MAZOS con tarjetas vencidas (no tarjetas individuales)
          res.json({
            dueCount: dueDeckCount,
            deckCount: dueDeckCount,
            cards: predictions,
          });
        }
      );
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
           GROUP BY fd.id, fd.title, s.name
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

/**
 * GET /api/analytics/user-stats/:userId
 *
 * Retorna estadísticas globales del usuario:
 * - Total de mazos, tarjetas, dominio general
 * - Estadísticas por materia
 * - Tarjetas vencidas, en aprendizaje, nuevas
 */
exports.getUserStats = (req, res) => {
  const { userId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  Promise.all([
    // Total stats
    new Promise((resolve) =>
      db.get(
        `SELECT 
           CAST(COUNT(DISTINCT fd.id) AS INTEGER) as total_decks,
           CAST(COUNT(DISTINCT fc.id) AS INTEGER) as total_cards,
           CAST(SUM(CASE WHEN fc.status = 'review' THEN 1 ELSE 0 END) AS INTEGER) as mastered_cards,
           CAST(SUM(CASE WHEN fc.status = 'learning' THEN 1 ELSE 0 END) AS INTEGER) as learning_cards,
           CAST(SUM(CASE WHEN fc.status = 'new' THEN 1 ELSE 0 END) AS INTEGER) as new_cards,
           CAST(COUNT(CASE WHEN fc.next_review_date <= CURRENT_TIMESTAMP THEN 1 END) AS INTEGER) as due_cards
         FROM flashcard_decks fd
         LEFT JOIN flashcards fc ON fc.deck_id = fd.id
         WHERE fd.user_id = ?`,
        [userId],
        (err, row) => resolve(row || {})
      )
    ),
    // Subject mastery
    new Promise((resolve) =>
      db.all(
        `SELECT 
           la.subject_id,
           s.name as subject_name,
           ROUND(la.mastery_percentage, 1) as mastery_percentage,
           la.total_reviews,
           la.correct_reviews
         FROM learning_analytics la
         LEFT JOIN subjects s ON la.subject_id = s.id
         WHERE la.user_id = ?
         ORDER BY la.mastery_percentage DESC`,
        [userId],
        (err, rows) => resolve(rows || [])
      )
    ),
    // Recent activity
    new Promise((resolve) =>
      db.all(
        `SELECT 
           DATE(cl.timestamp) as review_date,
           COUNT(*) as total_attempts,
           SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) as correct_attempts
         FROM card_logs cl
         WHERE cl.user_id = ?
         GROUP BY DATE(cl.timestamp)
         ORDER BY review_date DESC
         LIMIT 7`,
        [userId],
        (err, rows) => resolve(rows || [])
      )
    ),
  ])
    .then(([totalStats, subjectStats, recentActivity]) => {
      const globalMastery = totalStats.total_cards > 0
        ? Math.round((totalStats.mastered_cards / totalStats.total_cards) * 100)
        : 0;

      res.json({
        user_id: userId,
        global_mastery: globalMastery,
        total_decks: totalStats.total_decks || 0,
        total_cards: totalStats.total_cards || 0,
        mastered_cards: totalStats.mastered_cards || 0,
        learning_cards: totalStats.learning_cards || 0,
        new_cards: totalStats.new_cards || 0,
        due_cards: totalStats.due_cards || 0,
        subjects: subjectStats,
        recent_activity: recentActivity,
      });
    })
    .catch(err => {
      console.error('[getUserStats] Error:', err);
      res.status(500).json({ error: err.message });
    });
};

/**
 * GET /api/analytics/deck-stats/:deckId/:userId
 *
 * Retorna estadísticas detalladas de un mazo específico:
 * - Total de tarjetas y distribución de estados
 * - Tarjetas más difíciles (failure_rate)
 * - Progreso y dominio
 */
exports.getDeckStats = (req, res) => {
  const { deckId, userId } = req.params;

  if (!deckId || !userId) {
    return res.status(400).json({ error: 'deckId y userId son requeridos' });
  }

  Promise.all([
    // Deck info and distribution
    new Promise((resolve) =>
      db.get(
        `SELECT 
           fd.id,
           fd.title,
           fd.description,
           s.name as subject_name,
           CAST(COUNT(fc.id) AS INTEGER) as total_cards,
           CAST(SUM(CASE WHEN fc.status = 'review' THEN 1 ELSE 0 END) AS INTEGER) as mastered_count,
           CAST(SUM(CASE WHEN fc.status = 'learning' THEN 1 ELSE 0 END) AS INTEGER) as learning_count,
           CAST(SUM(CASE WHEN fc.status = 'new' THEN 1 ELSE 0 END) AS INTEGER) as new_count,
           CAST(COUNT(CASE WHEN fc.next_review_date <= CURRENT_TIMESTAMP THEN 1 END) AS INTEGER) as due_count,
           CAST(COUNT(DISTINCT cl.user_id) AS INTEGER) as total_reviews
         FROM flashcard_decks fd
         LEFT JOIN subjects s ON fd.subject_id = s.id
         LEFT JOIN flashcards fc ON fc.deck_id = fd.id
         LEFT JOIN card_logs cl ON fc.id = cl.card_id
         WHERE fd.id = ? AND fd.user_id = ?
         GROUP BY fd.id, fd.title, fd.description, s.name`,
        [deckId, userId],
        (err, row) => resolve(row || {})
      )
    ),
    // Difficult cards (high failure rate)
    new Promise((resolve) =>
      db.all(
        `SELECT 
           fc.id,
           fc.front,
           CAST(COUNT(cl.id) AS INTEGER) as total_attempts,
           CAST(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END) AS INTEGER) as error_count,
           ROUND(
             CAST(SUM(CASE WHEN cl.result = 'incorrect' THEN 1 ELSE 0 END) AS FLOAT) / 
             CAST(COUNT(cl.id) AS FLOAT) * 100,
             1
           ) as failure_rate,
           fc.fsrs_stability,
           fc.fsrs_difficulty
         FROM flashcards fc
         LEFT JOIN card_logs cl ON fc.id = cl.card_id AND cl.user_id = ?
         WHERE fc.deck_id = ? AND COUNT(cl.id) > 0
         GROUP BY fc.id
         ORDER BY failure_rate DESC
         LIMIT 10`,
        [userId, deckId],
        (err, rows) => resolve(rows || [])
      )
    ),
    // Mastery trend for this deck
    new Promise((resolve) =>
      db.all(
        `SELECT 
           DATE(cl.timestamp) as review_date,
           COUNT(*) as total_attempts,
           SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) as correct_attempts
         FROM card_logs cl
         JOIN flashcards fc ON cl.card_id = fc.id
         WHERE fc.deck_id = ? AND cl.user_id = ?
         GROUP BY DATE(cl.timestamp)
         ORDER BY review_date ASC
         LIMIT 30`,
        [deckId, userId],
        (err, rows) => resolve(rows || [])
      )
    ),
  ])
    .then(([deckInfo, difficultCards, masteryTrend]) => {
      const deckMastery = deckInfo.total_cards > 0
        ? Math.round((deckInfo.mastered_count / deckInfo.total_cards) * 100)
        : 0;

      res.json({
        deck_id: deckId,
        title: deckInfo.title || 'N/A',
        description: deckInfo.description || '',
        subject_name: deckInfo.subject_name || 'N/A',
        mastery_percentage: deckMastery,
        total_cards: deckInfo.total_cards || 0,
        mastered_cards: deckInfo.mastered_count || 0,
        learning_cards: deckInfo.learning_count || 0,
        new_cards: deckInfo.new_count || 0,
        due_cards: deckInfo.due_count || 0,
        total_reviews: deckInfo.total_reviews || 0,
        difficult_cards: difficultCards,
        mastery_trend: masteryTrend,
      });
    })
    .catch(err => {
      console.error('[getDeckStats] Error:', err);
      res.status(500).json({ error: err.message });
    });
};

/**
 * GET /api/analytics/global/gpa/:userId
 *
 * Calcula GPA global del estudiante (promedio ponderado de TODAS las materias)
 * Retorna:
 *  - currentAverage: Promedio ponderado global
 *  - projectedGrade: Proyección de calificación final (usando EMA o promedio simple)
 *  - delta: Diferencia entre promedio actual y proyección
 *  - evaluatedWeight: Porcentaje del semestre ya evaluado (global)
 *  - remainingWeight: Porcentaje pendiente de evaluación
 *  - assessmentCount: Total de evaluaciones
 *  - subjectCount: Total de materias con evaluaciones
 */
exports.getGlobalGPAAnalytics = (req, res) => {
  const { userId } = req.params;
  const startTime = Date.now();
  const TIMEOUT = 30000; // 30 segundos timeout

  if (!userId) {
    return res.status(400).json({ error: 'Se requiere userId' });
  }

  // Configurar timeout
  const timeoutId = setTimeout(() => {
    console.error(`[getGlobalGPAAnalytics] Request timeout para userId=${userId}`);
    if (!res.headersSent) {
      res.status(503).json({ error: 'Request timeout al calcular GPA global' });
    }
  }, TIMEOUT);

  try {
    // Calcular promedio global ponderado considerando todas las materias
    db.all(
      `SELECT 
         a.id,
         a.user_id,
         a.subject_id,
         a.grade_value,
         a.score,
         a.out_of,
         a.normalized_value,
         a.percentage,
         a.weight,
         a.date,
         s.name as subject_name
       FROM assessments a
       LEFT JOIN subjects s ON a.subject_id = s.id
       WHERE a.user_id = ?
       AND (a.grade_value IS NOT NULL OR a.score IS NOT NULL OR a.normalized_value IS NOT NULL)
       ORDER BY a.date DESC`,
      [userId],
      (err, assessments) => {
        clearTimeout(timeoutId);
        const duration = Date.now() - startTime;

        if (err) {
          console.error(`[getGlobalGPAAnalytics] Error DB para userId=${userId}: ${err.message} (${duration}ms)`);
          return res.status(500).json({ error: `Database error: ${err.message}` });
        }

        if (!assessments || assessments.length === 0) {
          console.log(`[getGlobalGPAAnalytics] Sin evaluaciones para userId=${userId}`);
          return res.json({
            currentAverage: 0,
            projectedGrade: 0,
            delta: 0,
            evaluatedWeight: 0,
            remainingWeight: 100,
            assessmentCount: 0,
            subjectCount: 0,
          });
        }

        try {
          // Normalizar y calcular promedio ponderado
          let totalWeightedGrade = 0;
          let totalWeight = 0;
          const subjects = new Set();

          assessments.forEach(a => {
            if (a.subject_id) subjects.add(a.subject_id);

            // Obtener la nota normalizada (0-1)
            let normalized = 0;
            if (typeof a.normalized_value === 'number') {
              normalized = a.normalized_value;
            } else if (typeof a.grade_value === 'number' && a.grade_value <= 5) {
              normalized = a.grade_value / 5; // Asumir escala 0-5
            } else if (typeof a.score === 'number' && typeof a.out_of === 'number' && a.out_of > 0) {
              normalized = a.score / a.out_of;
            }

            // Parsear peso (default 1 si no hay)
            let weight = 1;
            if (typeof a.percentage === 'number') {
              weight = a.percentage;
            } else if (typeof a.weight === 'string') {
              const parsed = parseFloat(a.weight);
              weight = !isNaN(parsed) ? Math.min(parsed, 100) : 1;
            } else if (typeof a.weight === 'number') {
              weight = a.weight;
            }

            // Convertir a escala 0-5 para visualización
            const gradeOutOf5 = normalized * 5;
            totalWeightedGrade += gradeOutOf5 * weight;
            totalWeight += weight;
          });

          const currentAverage = totalWeight > 0 ? totalWeightedGrade / totalWeight : 0;
          const projectedGrade = currentAverage; // Puede sofisticarse con EMA futura
          const delta = 0; // Delta future = EMA - current

          const result = {
            currentAverage: parseFloat(currentAverage.toFixed(2)),
            projectedGrade: parseFloat(projectedGrade.toFixed(2)),
            delta: delta,
            evaluatedWeight: Math.round((totalWeight / Math.max(totalWeight, 100)) * 100),
            remainingWeight: Math.max(0, 100 - Math.round((totalWeight / Math.max(totalWeight, 100)) * 100)),
            assessmentCount: assessments.length,
            subjectCount: subjects.size,
          };

          console.log(`[getGlobalGPAAnalytics] ✓ userId=${userId}, GPA=${result.currentAverage} (${duration}ms)`);
          res.json(result);
        } catch (calcErr) {
          console.error(`[getGlobalGPAAnalytics] Error al calcular GPA: ${calcErr.message}`);
          res.status(500).json({ error: `Error calculating GPA: ${calcErr.message}` });
        }
      }
    );
  } catch (err) {
    clearTimeout(timeoutId);
    console.error(`[getGlobalGPAAnalytics] Unexpected error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
};

/**
 * GET /api/analytics/progress-trends/:userId
 *
 * Retorna tendencia de progreso temporal del usuario:
 * - Dominio global por día/semana
 * - Actividad de estudio (intentos por día)
 * - Tasa de acierto temporal
 */
exports.getProgressTrends = (req, res) => {
  const { userId } = req.params;
  const { days = 30 } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'userId es requerido' });
  }

  const numDays = Math.max(7, Math.min(365, parseInt(days) || 30));

  Promise.all([
    // Daily mastery
    new Promise((resolve) =>
      db.all(
        `SELECT 
           DATE(cl.timestamp) as date,
           COUNT(*) as total_attempts,
           SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) as correct_attempts,
           ROUND(
             SUM(CASE WHEN cl.result = 'correct' THEN 1 ELSE 0 END) * 100.0 / COUNT(*),
             1
           ) as daily_accuracy
         FROM card_logs cl
         WHERE cl.user_id = ? AND DATE(cl.timestamp) >= DATE('now', '-' || ? || ' days')
         GROUP BY DATE(cl.timestamp)
         ORDER BY date ASC`,
        [userId, numDays],
        (err, rows) => resolve(rows || [])
      )
    ),
    // Cards created/reviewed timeline
    new Promise((resolve) =>
      db.all(
        `SELECT 
           DATE(cl.timestamp) as date,
           COUNT(DISTINCT fc.id) as cards_reviewed,
           COUNT(DISTINCT CASE WHEN cl.result = 'correct' THEN fc.id END) as cards_mastered
         FROM card_logs cl
         JOIN flashcards fc ON cl.card_id = fc.id
         WHERE cl.user_id = ? AND DATE(cl.timestamp) >= DATE('now', '-' || ? || ' days')
         GROUP BY DATE(cl.timestamp)
         ORDER BY date ASC`,
        [userId, numDays],
        (err, rows) => resolve(rows || [])
      )
    ),
    // Subject progress
    new Promise((resolve) =>
      db.all(
        `SELECT 
           s.name as subject_name,
           ROUND(la.mastery_percentage, 1) as mastery_percentage,
           la.total_reviews,
           la.correct_reviews
         FROM learning_analytics la
         LEFT JOIN subjects s ON la.subject_id = s.id
         WHERE la.user_id = ?
         ORDER BY mastery_percentage DESC`,
        [userId],
        (err, rows) => resolve(rows || [])
      )
    ),
  ])
    .then(([dailyMastery, cardsTimeline, subjectProgress]) => {
      res.json({
        user_id: userId,
        period_days: numDays,
        daily_mastery: dailyMastery,
        cards_timeline: cardsTimeline,
        subject_progress: subjectProgress,
      });
    })
    .catch(err => {
      console.error('[getProgressTrends] Error:', err);
      res.status(500).json({ error: err.message });
    });
};
