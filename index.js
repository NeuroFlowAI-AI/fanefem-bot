const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');
const pino = require('pino');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

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
      console.log('===== SCAN WITH WHATSAPP =====');
    }
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('Connection closed, reconnecting:', shouldReconnect);
      if (shouldReconnect) startBot();
    } else if (connection === 'open') {
      console.log('FANEFEM BOT READY - 3dafem!!! Connected to WhatsApp');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const from = msg.key.remoteJid;
      const text = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      console.log('Message from', from, ':', text);
      const lower = text.toLowerCase();

      if (lower.includes('order') || lower.includes('where')) {
        await sock.sendMessage(from, { text: '3dafem!!! Your order is processing. Rider will call you soon. Track at fanefem.com - No stress!' });
      } else if (lower.includes('shop') || lower.includes('sell')) {
        await sock.sendMessage(from, { text: 'Want to sell on Fanefem? Create free shop: https://fanefem-liveproduction1.vercel.app/login - You get money instantly, buyer pays delivery, rider picks up free. 3dafem!!!' });
      } else if (lower.includes('hi') || lower.includes('hello')) {
        await sock.sendMessage(from, { text: 'Akwaaba to Fanefem! 🛒

Buy: fanefem.com
Sell: Create shop free at /login

Type ORDER to track order
Type SHOP to start selling

3dafem!!!' });
      }
    }
  });

  // Notify on new Supabase orders
  supabase.channel('orders-notify').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
    console.log('New order', payload.new.id);
  }).subscribe();
}

startBot();
console.log('Starting light Fanefem bot...');
