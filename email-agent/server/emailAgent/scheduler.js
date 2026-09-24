// scheduler.js — arranca el ciclo del agente cada 30 minutos.
// Se importa una sola vez desde el server principal (ver ejemplo en README).

const cron = require('node-cron');
const { runOnce } = require('./runner');

function startScheduler() {
  // Cada 30 minutos. Ajusta el patrón cron si lo quieres más/menos frecuente.
  cron.schedule('*/30 * * * *', async () => {
    console.log('email-agent: revisando bandeja de entrada...');
    try {
      const results = await runOnce();
      console.log(`email-agent: ${results.length} correo(s) procesado(s)`);
    } catch (err) {
      console.error('email-agent: error en el ciclo programado', err);
    }
  });

  console.log('email-agent: scheduler iniciado (cada 30 min)');
}

module.exports = { startScheduler };
