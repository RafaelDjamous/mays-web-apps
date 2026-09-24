// storage.js — JSON file storage for the email agent log
// Follows the mays-web-apps convention: no database, plain JSON files.

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'email-agent-log.json');

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, '[]', 'utf8');
}

function readLog() {
  ensureStore();
  const raw = fs.readFileSync(LOG_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('email-agent: log file corrupto, reiniciando', err);
    return [];
  }
}

function writeLog(entries) {
  ensureStore();
  fs.writeFileSync(LOG_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

// Registra un correo ya procesado para no volver a clasificarlo/redactarlo dos veces.
function appendEntry(entry) {
  const entries = readLog();
  entries.unshift({
    ...entry,
    processedAt: new Date().toISOString(),
  });
  writeLog(entries);
  return entry;
}

function hasBeenProcessed(messageId) {
  const entries = readLog();
  return entries.some((e) => e.messageId === messageId);
}

function getRecentEntries(limit = 50) {
  return readLog().slice(0, limit);
}

module.exports = {
  appendEntry,
  hasBeenProcessed,
  getRecentEntries,
};
