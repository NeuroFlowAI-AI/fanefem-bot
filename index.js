const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');

let supabase = null;
try {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (url && key && url.startsWith('http')) {
    supabase = createClient(url, key);
    console.log('Supabase connected');
  } else {
    console.log('Supabase vars missing, bot will work without DB');
  }
} catch(e) {
  console.log('Supabase not configured, bot works without it');
}

const app = express();
let currentQR = null;
let status = 'Starting...';

app.get('/', (req, res) => {
  if (!currentQR) {
    res.send('<html><body style="text-align:center;font-family:sans-serif;padding:40px"><h1>Fanefem Bot Status: '+status+'</h1><p>Waiting for QR... auto refresh in 5 sec</p><script>setTimeout(()=>location.reload(),5000)</script></body></html>');
  } else {
    res.send('<html><body style="text-align:center;font-family:sans-serif;padding:20px"><h1>Scan this QR with WhatsApp</h1><p>Status: '+status+'</p><img src="'+currentQR+'" style="width:350px;height:350px;border:2px solid #000" /><p>WhatsApp > Settings > Linked Devices > Link Device</p><p>QR refreshes every 20s - keep page open</p><script>setTimeout(()=>location.reload(),5000)</script></body></html>');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web server on port', PORT));

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_web_final');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, browser: ['Fanefem', 'Chrome', '1.0'] });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      status = 'QR Ready - Scan now';
      currentQR = await QRCode.toDataURL(qr);
      console.log('QR ready, open your Railway public URL');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Closed', code);
      status = 'Reconnecting...';
      currentQR = null;
      if (code !== DisconnectReason.loggedOut) setTimeout(startBot, 3000);
      else { try{fs.rmSync('auth_web_final',{recursive:true,force:true})}catch(e){} startBot(); }
    } else if (connection === 'open') {
      status = 'CONNECTED - Bot is live - 3dafem';
      currentQR = null;
      console.log('********** BOT CONNECTED **********');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const m of messages) {
      if (!m.message || m.key.fromMe) continue;
      const from = m.key.remoteJid;
      const text = m.message.conversation || m.message.extendedTextMessage?.text || '';
      console.log('Msg:', text);
      const lower = text.toLowerCase();
      if (lower.includes('order')) await sock.sendMessage(from, { text: '3dafem Your order is processing. Rider will call you soon. Track at fanefem.com' });
      else if (lower.includes('shop')||lower.includes('sell')) await sock.sendMessage(from, { text: 'Sell on Fanefem: https://fanefem-liveproduction1.vercel.app/login - Free shop, instant money' });
      else if (lower.includes('hi')||lower.includes('hello')) await sock.sendMessage(from, { text: 'Akwaaba to Fanefem. Buy at fanefem.com. Type ORDER to track, SHOP to sell. 3dafem' });
    }
  });
}
startBot();
console.log('Starting Fanefem bot - v3.3 FINAL');
