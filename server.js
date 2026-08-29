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
    const data = JSON.parse(
      fs.readFileSync(DATA_FILE, 'utf8') || '[]'
    );
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


// ===============================
// САНАЛ, ГОМДОЛ ХАДГАЛАХ
// ===============================

app.post('/api/submit', (req, res) => {
  try {
    const body = req.body || {};
    const responses = readResponses();

    responses.push({
      id: crypto.randomUUID(),
      receivedAt: new Date().toISOString(),

      type: String(body.type || ''),
      date: body.date || '',

      name: String(body.name || ''),
      message: String(body.message || ''),

      answer: body.answer ?? null,

      // Санал асуулгын бүх хариуг хадгална
      answers: body.answers || {}
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


// ===============================
// АДМИН МЭДЭЭЛЭЛ АВАХ API
// ===============================

app.get('/api/admin/responses', (req, res) => {
  const password =
    req.get('x-admin-password') || '';

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


// ===============================
// АДМИН ХУУДАС
// ===============================

app.get('/admin', (req, res) => {

  res.type('html').send(`
<!DOCTYPE html>
<html lang="mn">

<head>
<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1.0"
>

<title>Ёс зүйн дэд хороо - Админ</title>

<style>

body {
  font-family: Arial, sans-serif;
  margin: 0;
  background: #f2f6fa;
}

.header {
  background: #1769aa;
  color: white;
  padding: 25px;
  text-align: center;
}

.container {
  max-width: 950px;
  margin: 25px auto;
  background: white;
  padding: 25px;
  border-radius: 15px;
}

.login {
  text-align: center;
  margin-bottom: 25px;
}

input {
  padding: 12px;
  font-size: 16px;
  width: 250px;
  max-width: 80%;
  border: 1px solid #bbb;
  border-radius: 8px;
}

button {
  padding: 12px 20px;
  font-size: 16px;
  background: #1769aa;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.status {
  text-align: center;
  margin: 15px;
  font-weight: bold;
}

.item {
  padding: 18px;
  margin: 12px 0;
  border: 1px solid #ddd;
  border-radius: 10px;
}

.item h3 {
  margin-top: 0;
}

.date {
  color: #777;
  font-size: 13px;
}

.answers {
  background: #f6f6f6;
  padding: 10px;
  border-radius: 8px;
  margin-top: 10px;
}

</style>
</head>


<body>

<div class="header">

<h1>Тариалан хүүхдийн цэцэрлэг</h1>

<h2>Ёс зүйн дэд хороо</h2>

<p>Ирсэн санал, гомдол, талархал</p>

</div>


<div class="container">

<div class="login">

<h3>Админ нэвтрэх</h3>

<input
  id="password"
  type="password"
  placeholder="Нууц үгээ оруулна уу"
>

<button onclick="loadResponses()">
Харах
</button>

</div>


<div
  id="status"
  class="status">
</div>

<div id="responses"></div>

</div>


<script>

function safe(value) {

  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}


function showAnswers(answers) {

  if (
    !answers ||
    typeof answers !== 'object' ||
    Object.keys(answers).length === 0
  ) {
    return '';
  }

  let html =
    '<div class="answers"><b>Хариултууд:</b>';

  Object.entries(answers).forEach(
    function(entry) {

      html +=
        '<p><b>' +
        safe(entry[0]) +
        ':</b> ' +
        safe(entry[1]) +
        '</p>';
    }
  );

  html += '</div>';

  return html;
}


async function loadResponses() {

  const password =
    document.getElementById('password').value;

  const status =
    document.getElementById('status');

  const container =
    document.getElementById('responses');

  if (!password) {

    status.textContent =
      'Нууц үгээ оруулна уу.';

    return;
  }


  status.textContent =
    'Мэдээлэл уншиж байна...';

  container.innerHTML = '';


  try {

    const response =
      await fetch(
        '/api/admin/responses',
        {
          headers: {
            'x-admin-password': password
          }
        }
      );


    const data =
      await response.json();


    if (!response.ok) {

      status.textContent =
        data.message ||
        'Нэвтрэх боломжгүй байна.';

      return;
    }


    const rows =
      Array.isArray(data.responses)
        ? data.responses
        : [];


    status.textContent =
      'Нийт ирсэн мэдээлэл: ' +
      rows.length;


    if (rows.length === 0) {

      container.innerHTML =
        '<p style="text-align:center;">Одоогоор мэдээлэл ирээгүй байна.</p>';

      return;
    }


    container.innerHTML =
      rows
        .slice()
        .reverse()
        .map(function(row) {

          const when =
            row.receivedAt ||
            row.createdAt ||
            row.date ||
            '';

          return \`

<div class="item">

<h3>
\${safe(row.type || 'Мэдээлэл')}
</h3>

\${row.name
  ? '<p><b>Нэр:</b> ' +
    safe(row.name) +
    '</p>'
  : ''
}

\${row.message
  ? '<p><b>Мэдээлэл:</b> ' +
    safe(row.message) +
    '</p>'
  : ''
}

\${row.answer !== null &&
   row.answer !== undefined &&
   row.answer !== ''
  ? '<p><b>Хариулт:</b> ' +
    safe(row.answer) +
    '</p>'
  : ''
}

\${showAnswers(row.answers)}

<div class="date">
\${safe(when)}
</div>

</div>

          \`;

        })
        .join('');


  } catch (error) {

    console.error(error);

    status.textContent =
      'Мэдээлэл унших үед алдаа гарлаа.';
  }
}

</script>

</body>
</html>
  `);
});


// ===============================
// QR КОД
// ===============================

app.get('/qr', async (req, res) => {

  try {

    const url =
      \`\${req.protocol}://\${req.get('host')}/\`;

    const qr =
      await QRCode.toBuffer(
        url,
        {
          width: 700,
          margin: 2
        }
      );

    res.type('png').send(qr);

  } catch (err) {

    console.error(err);

    res.status(500).send(
      'QR кодын алдаа'
    );
  }
});


// ===============================
// ҮНДСЭН САЙТ
// ===============================

app.get('/', (req, res) => {
  res.sendFile(INDEX_FILE);
});

app.get('/index.html', (req, res) => {
  res.sendFile(INDEX_FILE);
});

app.use(express.static(__dirname));


// ===============================
// SERVER
// ===============================

app.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      \`Running on \${PORT}\`
    );
  }
);
