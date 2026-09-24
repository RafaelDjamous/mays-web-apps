// routes.js — API para el dashboard del agente de ventas.
// Móntalo en tu app principal con: app.use('/api/email-agent', require('./emailAgent/routes'));

const express = require('express');
const router = express.Router();
const storage = require('./storage');
const { runOnce } = require('./runner');

// Lista los últimos correos procesados (para mostrar en el dashboard).
router.get('/logs', (req, res) => {
  const limit = parseInt(req.query.limit, 10) || 50;
  res.json(storage.getRecentEntries(limit));
});

// Dispara un ciclo manual (útil para probar sin esperar los 30 min del cron).
router.post('/run', async (req, res) => {
  try {
    const results = await runOnce();
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;
