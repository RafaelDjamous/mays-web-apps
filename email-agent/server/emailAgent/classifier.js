// classifier.js — calls the Claude API to (1) classify an incoming email and
// (2) draft a reply, in one call. Always produces a DRAFT — this module never
// decides to send; that's a human (Rafi) action, per the current MVP rules.

const fetch = require('node-fetch');

const CATEGORIES = [
  'cliente_existente', // consulta de un cliente que ya compra con MAYS
  'cliente_nuevo',     // primer contacto / prospecto nuevo
  'queja',             // reclamo o problema
  'seguimiento',       // no es una respuesta a un correo entrante, es follow-up proactivo
  'otro',
];

const SYSTEM_PROMPT = `Eres un asistente de ventas para MAY'S ZONA LIBRE, S.A., una empresa
mayorista de importación/distribución en la Zona Libre de Colón, Panamá, con más de 50 años
operando y clientes en Panamá, Centroamérica y el Caribe.

Tu tarea: dado el contenido de un correo de un cliente, clasifícalo y redacta un borrador de
respuesta profesional en español (o en el idioma del correo original si es distinto), con tono
cordial y directo, propio de ventas mayoristas B2B. NUNCA inventes precios, disponibilidad de
inventario, ni fechas de entrega que no te hayan sido dadas como contexto — si falta esa
información, el borrador debe pedir al cliente un momento para confirmar detalles, o dejar un
marcador claro como [CONFIRMAR PRECIO] para que Rafi lo complete antes de enviar.

Responde ÚNICAMENTE con un objeto JSON, sin texto adicional ni backticks, con esta forma exacta:
{
  "category": "cliente_existente" | "cliente_nuevo" | "queja" | "otro",
  "reasoning": "una frase breve explicando la clasificación",
  "draft_subject": "asunto sugerido si aplica, o null",
  "draft_body_html": "<p>cuerpo del borrador en HTML simple (p, br, ul/li, b/i)</p>"
}`;

async function callClaude(userContent) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${body}`);
  }
  const data = await res.json();
  const textBlock = data.content.find((c) => c.type === 'text');
  if (!textBlock) throw new Error('Respuesta de Claude sin bloque de texto');

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

// Clasifica y redacta un borrador de respuesta a un correo entrante.
async function classifyAndDraftReply({ fromAddress, subject, bodyText }) {
  const userContent = `Correo recibido de: ${fromAddress}
Asunto: ${subject}
Contenido:
${bodyText}`;

  const result = await callClaude(userContent);
  if (!CATEGORIES.includes(result.category)) result.category = 'otro';
  return result;
}

module.exports = {
  classifyAndDraftReply,
  CATEGORIES,
};
