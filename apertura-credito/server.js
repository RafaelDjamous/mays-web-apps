const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data', 'solicitudes.json');
const DRAFTS_FILE = path.join(__dirname, 'data', 'borradores.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify([], null, 2));
if (!fs.existsSync(DRAFTS_FILE)) fs.writeFileSync(DRAFTS_FILE, JSON.stringify([], null, 2));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

function readDB() {
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function readDrafts() {
  return JSON.parse(fs.readFileSync(DRAFTS_FILE, 'utf8'));
}
function writeDrafts(data) {
  fs.writeFileSync(DRAFTS_FILE, JSON.stringify(data, null, 2));
}
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code.slice(0,3) + '-' + code.slice(3);
}

// Submit new application
app.post('/api/solicitudes', upload.fields([
  { name: 'doc_identificacion', maxCount: 10 },
  { name: 'doc_empresa', maxCount: 5 },
  { name: 'doc_direccion', maxCount: 3 },
  { name: 'doc_ref_bancaria', maxCount: 5 },
  { name: 'doc_ref_bancaria_1', maxCount: 3 },
  { name: 'doc_ref_bancaria_2', maxCount: 3 },
  { name: 'doc_ref_comercial', maxCount: 5 },
  { name: 'doc_ref_comercial_1', maxCount: 3 },
  { name: 'doc_ref_comercial_2', maxCount: 3 },
  { name: 'doc_ref_comercial_3', maxCount: 3 }
]), (req, res) => {
  try {
    const db = readDB();
    const id = uuidv4();
    const noSolicitud = 'SOL-' + Date.now();

    const docs = {};
    if (req.files) {
      Object.keys(req.files).forEach(field => {
        docs[field] = req.files[field].map(f => ({
          originalname: f.originalname,
          filename: f.filename,
          path: '/uploads/' + f.filename
        }));
      });
    }

    const solicitud = {
      id,
      noSolicitud,
      fecha: new Date().toISOString(),
      estado: 'Pendiente',
      datos: JSON.parse(req.body.datos || '{}'),
      documentos: docs
    };

    db.push(solicitud);
    writeDB(db);

    res.json({ success: true, noSolicitud, id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get all applications (admin)
app.get('/api/solicitudes', (req, res) => {
  const { password } = req.query;
  if (password !== 'mays2025') return res.status(401).json({ error: 'No autorizado' });
  const db = readDB();
  res.json(db);
});

// Get single application
app.get('/api/solicitudes/:id', (req, res) => {
  const { password } = req.query;
  if (password !== 'mays2025') return res.status(401).json({ error: 'No autorizado' });
  const db = readDB();
  const s = db.find(x => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'No encontrado' });
  res.json(s);
});

// Update status
app.patch('/api/solicitudes/:id', (req, res) => {
  const { password } = req.query;
  if (password !== 'mays2025') return res.status(401).json({ error: 'No autorizado' });
  const db = readDB();
  const idx = db.findIndex(x => x.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'No encontrado' });
  db[idx].estado = req.body.estado || db[idx].estado;
  db[idx].notas = req.body.notas || db[idx].notas;
  writeDB(db);
  res.json({ success: true });
});

// Save draft (new)
app.post('/api/borradores', (req, res) => {
  try {
    const drafts = readDrafts();
    let code = generateCode();
    while (drafts.find(d => d.code === code)) code = generateCode();
    const draft = {
      code,
      fecha: new Date().toISOString(),
      ultimoGuardado: new Date().toISOString(),
      paso: req.body.paso || 0,
      datos: req.body.datos || {}
    };
    drafts.push(draft);
    writeDrafts(drafts);
    res.json({ success: true, code });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Update existing draft
app.put('/api/borradores/:code', (req, res) => {
  try {
    const drafts = readDrafts();
    const idx = drafts.findIndex(d => d.code === req.params.code);
    if (idx === -1) return res.status(404).json({ error: 'Borrador no encontrado' });
    drafts[idx].ultimoGuardado = new Date().toISOString();
    drafts[idx].paso = req.body.paso ?? drafts[idx].paso;
    drafts[idx].datos = req.body.datos || drafts[idx].datos;
    writeDrafts(drafts);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get draft by code
app.get('/api/borradores/:code', (req, res) => {
  const drafts = readDrafts();
  const draft = drafts.find(d => d.code === req.params.code.toUpperCase());
  if (!draft) return res.status(404).json({ error: 'Código no encontrado' });
  res.json(draft);
});

app.listen(PORT, () => {
  console.log(`\n  MAYS Zona Libre - Portal de Crédito`);
  console.log(`  Cliente: http://localhost:${PORT}`);
  console.log(`  Admin:   http://localhost:${PORT}/admin.html`);
  console.log(`  Contraseña admin: mays2025\n`);
});
