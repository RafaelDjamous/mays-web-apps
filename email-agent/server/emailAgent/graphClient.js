// graphClient.js — wrapper around Microsoft Graph for the sales email agent.
// Uses app-only auth (client credentials) so it can run unattended on a schedule,
// acting on a single mailbox: process.env.MAILBOX_USER_ID (Rafi's Outlook address).
//
// Requires an Azure AD (Entra ID) App Registration with Application permissions:
//   Mail.Read, Mail.ReadWrite, Mail.Send  (admin consent granted)
// See CONTEXT-email-agent.md for the setup steps — this is a one-time manual
// step in the Azure portal that Rafi has to do himself.

const { ConfidentialClientApplication } = require('@azure/msal-node');
const fetch = require('node-fetch');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
});

async function getToken() {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  return result.accessToken;
}

async function graphFetch(pathSuffix, options = {}) {
  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}${pathSuffix}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Graph API error ${res.status}: ${body}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

const mailboxPath = () => `/users/${process.env.MAILBOX_USER_ID}`;

// Trae correos no leídos de la bandeja de entrada (los más recientes primero).
async function getUnreadInboxMessages(top = 15) {
  const data = await graphFetch(
    `${mailboxPath()}/mailFolders/Inbox/messages?$filter=isRead eq false&$top=${top}&$orderby=receivedDateTime desc`
  );
  return data.value || [];
}

// Marca un correo como leído para no reprocesarlo.
async function markAsRead(messageId) {
  await graphFetch(`${mailboxPath()}/messages/${messageId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isRead: true }),
  });
}

// Crea un borrador de RESPUESTA a un correo (queda en Drafts, listo para que Rafi lo revise y envíe).
async function createReplyDraft(messageId, bodyHtml) {
  const draft = await graphFetch(`${mailboxPath()}/messages/${messageId}/createReply`, {
    method: 'POST',
  });
  const updated = await graphFetch(`${mailboxPath()}/messages/${draft.id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      body: { contentType: 'HTML', content: bodyHtml },
    }),
  });
  return updated; // incluye webLink para abrir el borrador directo en Outlook
}

// Crea un borrador de correo NUEVO (para seguimiento proactivo, no es respuesta a nada).
async function createNewDraft({ to, subject, bodyHtml }) {
  const draft = await graphFetch(`${mailboxPath()}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      subject,
      body: { contentType: 'HTML', content: bodyHtml },
      toRecipients: to.map((addr) => ({ emailAddress: { address: addr } })),
    }),
  });
  return draft;
}

// Notifica a Rafi (correo nuevo / queja) enviándole un aviso corto a su propia bandeja.
async function notifyRafi(subject, bodyHtml) {
  await graphFetch(`${mailboxPath()}/sendMail`, {
    method: 'POST',
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: 'HTML', content: bodyHtml },
        toRecipients: [{ emailAddress: { address: process.env.MAILBOX_USER_ID } }],
      },
      saveToSentItems: false,
    }),
  });
}

module.exports = {
  getUnreadInboxMessages,
  markAsRead,
  createReplyDraft,
  createNewDraft,
  notifyRafi,
};
