// index.js — punto de arranque del servicio del agente de ventas.
// Sirve el dashboard, monta la API, y arranca el cron que revisa el correo.

const express = require('express');
const path = require('path');
const { startScheduler } = require('./server/emailAgent/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

app.use('/api/email-agent', require('./server/emailAgent/routes'));
app.use('/email-agent', express.static(path.join(__dirname, 'public', 'email-agent')));

// Ruta raíz simple, útil para que UptimeRobot (o Render) confirme que el servicio está vivo.
app.get('/', (req, res) => {
  res.send('Agente de ventas MAYS — activo. Dashboard: /email-agent/dashboard.html');
});

app.listen(PORT, () => {
  console.log(`email-agent: escuchando en el puerto ${PORT}`);
  startScheduler();
});
