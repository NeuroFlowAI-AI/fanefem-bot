const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.log('WARNING: Set SUPABASE_URL and SUPABASE_KEY in Railway Variables');
}
const supabase = createClient(supabaseUrl || 'https://example.supabase.co', supabaseKey || 'anon');

const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--disable-gpu']
  }
});

client.on('qr', qr => {
  console.log('SCAN THIS QR WITH WHATSAPP:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('FANEFEM BOT READY - 3dafem!!! Bot is live');
});

client.on('message', async msg => {
  try {
    const body = msg.body.toLowerCase();
    const from = msg.from;
    console.log('Message from', from, ':', msg.body);

    if (body.includes('order') || body.includes('where') || body.includes('rider')) {
      await msg.reply('3dafem!!! Your order is being processed. Rider will call you soon. Track at fanefem.com - No stress!');
    }
    if (body.includes('shop') || body.includes('sell')) {
      await msg.reply('Want to sell on Fanefem? Create free shop: https://fanefem-liveproduction1.vercel.app/login - You get money instantly, buyer pays delivery, rider picks up free. 3dafem!!!');
    }
  } catch (e) {
    console.error('Msg error', e);
  }
});

client.initialize();

console.log('Starting Fanefem bot... waiting for QR');
