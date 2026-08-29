const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CHANGE-ME-NOW';

const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

function readResponses() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
  } catch {
    return [];
  }
}

function writeResponses(rows) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

app.post('/api/submit', (req, res) => {
  try {
    const body = req.body || {};

    const row = {
      id: crypto.randomUUID(),
      type: String(body.type || ''),
      name: String(body.name || ''),
      message: String(body.message || ''),
      answer: body.answer ?? null,
      createdAt: new Date().toISOString()
    };

    const rows = readResponses();
    rows.push(row);
    writeResponses(rows);

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false });
  }
});

app.get('/api/admin/responses', (req, res) => {
  const password = req.get('x-admin-password') || '';

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({
      ok: false,
      message: 'Нууц үг буруу байна.'
    });
  }

  res.json({
    ok: true,
    responses: readResponses()
  });
});

app.get('/qr', async (req, res) => {
  try {
    const url = `${req.protocol}://${req.get('host')}/`;
    const qr = await QRCode.toBuffer(url, {
      width: 700,
      margin: 2
    });

    res.type('png').send(qr);
  } catch (err) {
    res.status(500).send('QR алдаа');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Running on ${PORT}`);
});
