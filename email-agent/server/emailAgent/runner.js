// runner.js — el ciclo principal del agente. Se puede llamar manualmente
// (POST /api/email-agent/run) o dejar en cron (ver scheduler.js).
//
// Reglas actuales (MVP, definidas con Rafi):
//   - NUNCA se envía nada automáticamente. Todo queda como borrador en Outlook.
//   - Si la categoría es "cliente_nuevo" o "queja", además se envía un aviso
//     corto a Rafi para que lo revise cuanto antes.

const graph = require('./graphClient');
const { classifyAndDraftReply } = require('./classifier');
const storage = require('./storage');

// Convierte el body HTML/texto de Graph a texto plano simple para pasarlo a Claude.
function extractPlainText(message) {
  const raw = message.body?.content || message.bodyPreview || '';
  return raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function processOneMessage(message) {
  const fromAddress = message.from?.emailAddress?.address || 'desconocido';
  const bodyText = extractPlainText(message);

  const result = await classifyAndDraftReply({
    fromAddress,
    subject: message.subject,
    bodyText,
  });

  const draft = await graph.createReplyDraft(message.id, result.draft_body_html);

  if (result.category === 'cliente_nuevo' || result.category === 'queja') {
    await graph.notifyRafi(
      `[Agente de ventas] ${result.category === 'queja' ? 'Queja' : 'Cliente nuevo'}: ${message.subject}`,
      `<p>Correo de <b>${fromAddress}</b> clasificado como <b>${result.category}</b>.</p>
       <p>Motivo: ${result.reasoning}</p>
       <p><a href="${draft.webLink}">Abrir el borrador de respuesta en Outlook</a></p>`
    );
  }

  await graph.markAsRead(message.id);

  storage.appendEntry({
    messageId: message.id,
    from: fromAddress,
    subject: message.subject,
    category: result.category,
    reasoning: result.reasoning,
    draftWebLink: draft.webLink,
    notified: result.category === 'cliente_nuevo' || result.category === 'queja',
  });
}

// Corre un ciclo: trae correos no leídos, procesa los que no se hayan procesado ya.
async function runOnce() {
  const messages = await graph.getUnreadInboxMessages(15);
  const results = [];

  for (const message of messages) {
    if (storage.hasBeenProcessed(message.id)) continue;
    try {
      await processOneMessage(message);
      results.push({ id: message.id, ok: true });
    } catch (err) {
      console.error(`email-agent: error procesando mensaje ${message.id}`, err);
      results.push({ id: message.id, ok: false, error: err.message });
    }
  }

  return results;
}

module.exports = { runOnce };
