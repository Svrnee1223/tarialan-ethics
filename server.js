const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const QRCode = require('qrcode');

const app = express();
const PORT = process.env.PORT || 10000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'CHANGE-ME-NOW';

const ROOT = __dirname;
const INDEX_FILE = path.join(ROOT, 'index.html');
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'responses.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
  }
}

function readResponses() {
  try {
    ensureDataFile();

    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const data = JSON.parse(raw || '[]');

    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error('Read error:', err);
    return [];
  }
}

function writeResponses(rows) {
  ensureDataFile();

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(rows, null, 2),
    'utf8'
  );
}

ensureDataFile();

app.disable('x-powered-by');

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));


/* =========================
   HEALTH
========================= */

app.get('/health', (req, res) => {
  res.json({ ok: true });
});


/* =========================
   САНАЛ, ГОМДОЛ ХАДГАЛАХ
========================= */

app.post('/api/submit', (req, res) => {
  try {
    const body = req.body || {};
    const rows = readResponses();

    rows.push({
      id: crypto.randomUUID(),

      type: String(body.type || ''),
      date: String(body.date || ''),

      name: String(body.name || ''),
      message: String(body.message || ''),

      answer: body.answer ?? null,

      answers:
        body.answers &&
        typeof body.answers === 'object'
          ? body.answers
          : {},

      createdAt: new Date().toISOString()
    });

    writeResponses(rows);

    res.json({
      ok: true,
      message: 'Амжилттай илгээгдлээ.'
    });

  } catch (err) {
    console.error('Submit error:', err);

    res.status(500).json({
      ok: false,
      message: 'Хадгалах үед алдаа гарлаа.'
    });
  }
});


/* =========================
   АДМИН API
========================= */

app.get('/api/admin/responses', (req, res) => {

  const password =
    req.get('x-admin-password') || '';

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


/* =========================
   АДМИН ХУУДАС
========================= */

app.get('/admin', (req, res) => {

  res.type('html').send(`
<!doctype html>

<html lang="mn">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1"
>

<title>
Ёс зүйн дэд хороо - Админ
</title>

<style>

body {
  font-family: Arial, sans-serif;
  background: #f4f7fb;
  margin: 0;
  padding: 24px;
}

.box {
  max-width: 900px;
  margin: auto;
  background: white;
  padding: 24px;
  border-radius: 16px;
}

h1 {
  font-size: 24px;
  margin-top: 0;
}

input,
button {
  padding: 11px 12px;
  font-size: 16px;
}

input {
  width: 240px;
  max-width: 70%;
}

button {
  cursor: pointer;
}

.item {
  border-top: 1px solid #ddd;
  padding: 14px 0;
}

.date {
  color: #777;
  font-size: 13px;
}

.answers {
  background: #f7f7f7;
  padding: 10px;
  border-radius: 8px;
  margin-top: 8px;
}

</style>

</head>


<body>

<div class="box">

<h1>
Тариалан хүүхдийн цэцэрлэг
</h1>

<h2>
Ёс зүйн санал, гомдол
</h2>


<input
  id="pw"
  type="password"
  placeholder="Админ нууц үг"
>


<button id="showBtn">
Харах
</button>


<p id="status"></p>

<div id="list"></div>

</div>


<script>

function esc(v) {

  return String(
    v == null ? '' : v
  )
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');
}


function answersHtml(obj) {

  if (
    !obj ||
    typeof obj !== 'object'
  ) {
    return '';
  }

  var keys =
    Object.keys(obj);

  if (!keys.length) {
    return '';
  }

  var html =
    '<div class="answers"><b>Хариултууд:</b>';

  keys.forEach(
    function(key) {

      var value =
        obj[key];

      if (Array.isArray(value)) {
        value =
          value.join(', ');
      }

      html +=
        '<div><b>' +
        esc(key) +
        ':</b> ' +
        esc(value) +
        '</div>';
    }
  );

  html += '</div>';

  return html;
}


async function loadData() {

  var pw =
    document
    .getElementById('pw')
    .value;


  var status =
    document
    .getElementById('status');


  var list =
    document
    .getElementById('list');


  if (!pw) {

    status.textContent =
      'Нууц үгээ оруулна уу.';

    return;
  }


  status.textContent =
    'Уншиж байна...';


  list.innerHTML = '';


  try {

    var response =
      await fetch(
        '/api/admin/responses',
        {
          headers: {
            'x-admin-password': pw
          }
        }
      );


    var data =
      await response.json();


    if (!response.ok) {

      status.textContent =
        data.message ||
        'Нэвтрэх боломжгүй.';

      return;
    }


    var rows =
      Array.isArray(data.responses)
        ? data.responses
        : [];


    status.textContent =
      'Нийт ирсэн мэдээлэл: ' +
      rows.length;


    if (!rows.length) {

      list.innerHTML =
        '<p>Одоогоор мэдээлэл ирээгүй байна.</p>';

      return;
    }


    list.innerHTML =
      rows
      .slice()
      .reverse()
      .map(
        function(row) {

          var html =
            '<div class="item">';


          html +=
            '<h3>' +
            esc(
              row.type ||
              'Мэдээлэл'
            ) +
            '</h3>';


          if (row.name) {

            html +=
              '<div><b>Нэр:</b> ' +
              esc(row.name) +
              '</div>';
          }


          if (row.message) {

            html +=
              '<div><b>Мэдээлэл:</b> ' +
              esc(row.message) +
              '</div>';
          }


          if (
            row.answer !== null &&
            row.answer !== undefined &&
            row.answer !== ''
          ) {

            html +=
              '<div><b>Хариулт:</b> ' +
              esc(row.answer) +
              '</div>';
          }


          html +=
            answersHtml(
              row.answers
            );


          var when =
            row.createdAt ||
            row.date ||
            '';


          if (when) {

            html +=
              '<div class="date">' +
              esc(when) +
              '</div>';
          }


          html += '</div>';

          return html;
        }
      )
      .join('');


  } catch (err) {

    status.textContent =
      'Сервертэй холбогдож чадсангүй.';
  }
}


document
.getElementById('showBtn')
.addEventListener(
  'click',
  loadData
);

</script>

</body>

</html>
  `);
});


/* =========================
   QR КОД
========================= */

app.get('/qr', async (req, res) => {

  try {

    const url =
      `${req.protocol}://${req.get('host')}/`;


    const png =
      await QRCode.toBuffer(
        url,
        {
          type: 'png',
          width: 700,
          margin: 2
        }
      );


    res
      .type('png')
      .send(png);

  } catch (err) {

    console.error(
      'QR error:',
      err
    );


    res
      .status(500)
      .send(
        'QR код үүсгэж чадсангүй.'
      );
  }
});


/* =========================
   ҮНДСЭН САЙТ
========================= */

app.use(
  express.static(
    ROOT,
    {
      index: false
    }
  )
);


app.get(
  ['/', '/index.html'],
  (req, res) => {

    if (
      !fs.existsSync(
        INDEX_FILE
      )
    ) {

      return res
        .status(500)
        .send(
          'index.html файл олдсонгүй.'
        );
    }


    res.sendFile(
      INDEX_FILE
    );
  }
);


/* =========================
   404
========================= */

app.use(
  (req, res) => {

    res
      .status(404)
      .send(
        'Хуудас олдсонгүй.'
      );
  }
);


/* =========================
   SERVER START
========================= */

app.listen(
  PORT,
  '0.0.0.0',
  () => {

    console.log(
      `Tarialan Ethics running on port ${PORT}`
    );
  }
);
