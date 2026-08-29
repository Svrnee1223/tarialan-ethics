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
const INDEX_FILE = path.join(__dirname, 'index.html');

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
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8') || '[]');
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(err);
    return [];
  }
}

function writeResponses(data) {
  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

app.post('/api/submit', (req, res) => {
  try {
    const body = req.body || {};

    const responses = readResponses();

    responses.push({
      id: crypto.randomUUID(),
      type: String(body.type || ''),
      name: String(body.name || ''),
      message: String(body.message || ''),
      answer: body.answer ?? null,
      createdAt: new Date().toISOString()
    });

    writeResponses(responses);

    return res.json({
      ok: true,
      message: 'Амжилттай илгээгдлээ.'
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      ok: false,
      message: 'Хадгалах үед алдаа гарлаа.'
    });
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

  return res.json({
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
    console.error(err);
    res.status(500).send('QR кодын алдаа');
  }
});

app.get('/', (req, res) => {
  res.sendFile(INDEX_FILE);
});

app.get('/index.html', (req, res) => {
  res.sendFile(INDEX_FILE);
});

app.use(express.static(__dirname));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Running on ${PORT}`);
});
