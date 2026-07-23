const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL || 'https://example.supabase.co', process.env.SUPABASE_KEY || 'anon');

async function startBot() {
  // Use fresh auth folder v2 to force new QR
  const { state, saveCreds } = await useMultiFileAuthState('auth_fresh_v4');
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    browser: ['Fanefem Bot', 'Chrome', '1.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n\n==================== SCAN THIS QR NOW ====================');
      qrcode.generate(qr, { small: true });
      console.log('Open WhatsApp > Linked Devices > Link a Device > Scan');
      console.log('QR will expire in 20 seconds, new one will appear');
      console.log('==========================================================\n\n');
    }
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      console.log('Connection closed code:', statusCode);
      if (statusCode === DisconnectReason.loggedOut) {
        console.log('Logged out, deleting auth and restarting...');
        try { fs.rmSync('auth_fresh_v4', { recursive: true, force: true }); } catch(e){}
        startBot();
      } else {
        console.log('Reconnecting in 3 seconds...');
        setTimeout(() => startBot(), 3000);
      }
    } else if (connection === 'open') {
      console.log('\n********** FANEFEM BOT READY - 3dafem Connected **********\n');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      console.log('Message:', text);
      const lower = text.toLowerCase();
      if (lower.includes('order') || lower.includes('where')) {
        await sock.sendMessage(from, { text: '3dafem Your order is processing. Rider will call you soon. Track at fanefem.com' });
      } else if (lower.includes('shop') || lower.includes('sell')) {
        await sock.sendMessage(from, { text: 'Sell on Fanefem: https://fanefem-liveproduction1.vercel.app/login - Free shop, instant money' });
      } else if (lower.includes('hi') || lower.includes('hello')) {
        await sock.sendMessage(from, { text: 'Akwaaba to Fanefem. Buy at fanefem.com. Type ORDER to track, SHOP to sell. 3dafem' });
      }
    }
  });
}

startBot();
console.log('Starting Fanefem bot v3.2 - waiting for QR...');
