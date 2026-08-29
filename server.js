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

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]', 'utf8');

app.use(express.json({ limit: '1mb }));
app.use(express.static(__dirname));
function readResponses(){
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); }
  catch { return []; }
}
function writeResponses(rows){
  fs.writeFileSync(DATA_FILE, JSON.stringify(rows, null, 2), 'utf8');
}

app.post('/api/submit', (req, res) => app.use(express.static(__dirname));{
  const body = req.body || {};
  if (!['Талархал','Гомдол','Санал асуулга'].includes(body.type)) {
    return res.status(400).json({ok:false});
  }
  const rows = readResponses();
  rows.push({
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    type: body.type,
    date: body.date || '',
    answers: body.answers || {}
  });
  writeResponses(rows);
  res.json({ok:true});
});

function adminAuthorized(req){
  const supplied = req.get('x-admin-password') || '';
  return supplied && supplied === ADMIN_PASSWORD;
}

app.get('/api/admin/responses', (req, res) => {
  if (!adminAuthorized(req)) return res.status(401).json({error:'unauthorized'});
  res.json(readResponses());
});

app.get('/qr', async (req, res) => {
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  const url = `${protocol}://${host}/`;
  try{
    const png = await QRCode.toBuffer(url, { width: 700, margin: 2 });
    res.type('png').send(png);
  }catch(e){
    res.status(500).send('QR алдаа');
  }
});

app.get('/admin', (req, res) => {
  res.send(`<!doctype html>
<html lang="mn"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ёс зүйн дэд хороо - Админ</title>
<style>
body{font-family:Arial,sans-serif;background:#f4f7fb;margin:0;padding:20px;color:#1f2937}
.wrap{max-width:1000px;margin:auto}.box{background:#fff;padding:20px;border-radius:16px;box-shadow:0 8px 25px rgba(0,0,0,.08)}
input,button{padding:11px;border-radius:9px;border:1px solid #ccd5df;font-size:15px}
button{background:#0d47a1;color:#fff;font-weight:700;cursor:pointer}.row{display:flex;gap:8px;flex-wrap:wrap}
.card{border:1px solid #dce5ef;border-radius:12px;padding:14px;margin-top:12px;background:#fbfdff}
pre{white-space:pre-wrap;word-break:break-word;background:#f5f7fa;padding:10px;border-radius:8px}
</style></head>
<body><div class="wrap"><div class="box">
<h2>Тариалан хүүхдийн цэцэрлэг – Нууц админ</h2>
<p>Санал, гомдол, талархлын мэдээллийг зөвхөн админ нууц үгтэй хүн харна.</p>
<div class="row"><input id="pw" type="password" placeholder="Админ нууц үг"><button onclick="loadData()">Нэвтрэх</button></div>
<div id="status"></div><div id="list"></div>
</div></div>
<script>
async function loadData(){
 const pw=document.getElementById('pw').value;
 const s=document.getElementById('status'), list=document.getElementById('list');
 s.textContent='Уншиж байна...'; list.innerHTML='';
 const r=await fetch('/api/admin/responses',{headers:{'x-admin-password':pw}});
 if(!r.ok){s.textContent='Нууц үг буруу байна.';return;}
 const rows=await r.json(); s.textContent='Нийт '+rows.length+' мэдээлэл.';
 rows.slice().reverse().forEach(x=>{
   const d=document.createElement('div'); d.className='card';
   const h=document.createElement('h3'); h.textContent=x.type+' • '+(x.date||x.receivedAt); d.appendChild(h);
   const p=document.createElement('pre'); p.textContent=JSON.stringify(x.answers,null,2); d.appendChild(p);
   list.appendChild(d);
 });
}
</script></body></html>`);
});

app.listen(PORT, () => console.log(`Running on ${PORT}`));
