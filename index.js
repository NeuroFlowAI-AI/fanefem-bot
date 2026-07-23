const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const pino = require('pino');

const supabase = createClient(process.env.SUPABASE_URL || 'https://example.supabase.co', process.env.SUPABASE_KEY || 'anon');

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState('auth_info');
  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
  });
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('===== SCAN THIS QR =====');
      qrcode.generate(qr, { small: true });
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('FANEFEM BOT READY - 3dafem Connected');
    }
  });
  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      console.log('Msg', text);
      const lower = text.toLowerCase();
      if (lower.includes('order') || lower.includes('where')) {
        await sock.sendMessage(from, { text: '3dafem Your order is processing. Rider will call you soon. Track at fanefem.com' });
      } else if (lower.includes('shop') || lower.includes('sell')) {
        await sock.sendMessage(from, { text: 'Sell on Fanefem: https://fanefem-liveproduction1.vercel.app/login - Free shop, instant money, rider picks free' });
      } else if (lower.includes('hi') || lower.includes('hello')) {
        await sock.sendMessage(from, { text: 'Akwaaba to Fanefem. Buy at fanefem.com. Type ORDER to track, SHOP to sell. 3dafem' });
      }
    }
  });
}

startBot();
console.log('Starting bot...');
