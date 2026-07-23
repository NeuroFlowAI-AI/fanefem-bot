const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const express = require('express');
const QRCode = require('qrcode');

const app = express();
let currentQR = null;
let status = 'Starting...';
let waSock = null;

app.get('/', async (req, res) => {
  if (status.includes('CONNECTED')) {
    res.send(`<html><body style="text-align:center;font-family:sans-serif;padding:30px">
    <h1 style="color:green">Fanefem Bot CONNECTED - 3dafem!</h1>
    <p>Status: ${status}</p>
    <p>Bot is sending order alerts automatically</p>
    <p>Test: Send "hi" to your business WhatsApp</p>
    </body></html>`);
  } else if (!currentQR) {
    res.send(`<h1>Fanefem Bot: ${status}</h1><p>Waiting for QR... refresh</p><script>setTimeout(()=>location.reload(),5000)</script>`);
  } else {
    res.send(`<html><body style="text-align:center;font-family:sans-serif;padding:20px">
    <h1>Scan QR - Fanefem</h1><p>${status}</p><img src="${currentQR}" style="width:350px" />
    <p>WhatsApp > Linked Devices > Link Device</p><script>setTimeout(()=>location.reload(),5000)</script></body></html>`);
  }
});
app.get('/health', (req,res)=>res.json({status, connected: status.includes('CONNECTED')}));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Web on', PORT));

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

function formatGH(num){ return 'GHS '+(num||0).toFixed(2); }

async function notifyOrder(order){
  if(!waSock) return;
  try{
    // Get trader phone
    const { data: trader } = await supabase.from('traders').select('*').eq('id', order.trader_id).single();
    const { data: customer } = await supabase.from('orders').select('*').eq('id', order.id).single();
    console.log('New order to notify:', order.id, 'Trader:', trader?.phone);
    
    // Notify trader if phone exists
    if(trader?.phone){
      let phone = trader.phone.replace(/\D/g,'');
      if(phone.startsWith('0')) phone = '233'+phone.substring(1);
      if(!phone.startsWith('233')) phone = '233'+phone;
      const traderJid = phone+'@s.whatsapp.net';
      const msg = `3dafem! NEW ORDER!

Order: ${order.id.slice(0,8)}
Customer: ${customer?.customer_name||'Customer'}
Phone: ${customer?.customer_phone||''}
Amount: ${formatGH(order.total_amount)}
Items: ${order.items?.length||1}

Action: Pack now! Rider will pick up soon.
Check: fanefem.com/dashboard`;
      await waSock.sendMessage(traderJid, { text: msg });
      console.log('Notified trader', phone);
    }
    // Notify customer if phone
    if(customer?.customer_phone){
      let cPhone = customer.customer_phone.replace(/\D/g,'');
      if(cPhone.startsWith('0')) cPhone = '233'+cPhone.substring(1);
      if(!cPhone.startsWith('233')) cPhone = '233'+cPhone;
      const custJid = cPhone+'@s.whatsapp.net';
      const custMsg = `Akwaaba! Your Fanefem order ${order.id.slice(0,8)} confirmed!
Total: ${formatGH(order.total_amount)}
Rider will call you soon. Track: fanefem.com/track/${order.id}

3dafem - No stress!`;
      await waSock.sendMessage(custJid, { text: custMsg });
      console.log('Notified customer', cPhone);
    }
  }catch(e){ console.error('Notify error', e.message); }
}

async function startBot(){
  const { state, saveCreds } = await useMultiFileAuthState('auth_fanefem_final');
  const { version } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({ version, auth: state, browser: ['Fanefem','Chrome','1.0'] });
  waSock = sock;
  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', async (update)=>{
    const { connection, lastDisconnect, qr } = update;
    if(qr){ status='QR Ready - Scan now'; currentQR = await QRCode.toDataURL(qr); console.log('QR ready'); }
    if(connection==='close'){
      const code = lastDisconnect?.error?.output?.statusCode;
      console.log('Closed', code); status='Reconnecting...'; currentQR=null;
      if(code!==DisconnectReason.loggedOut) setTimeout(startBot,3000);
      else { try{fs.rmSync('auth_fanefem_final',{recursive:true,force:true})}catch(e){} startBot(); }
    } else if(connection==='open'){
      status='CONNECTED - Bot is live - 3dafem!'; currentQR=null; console.log('BOT CONNECTED');
      // Subscribe to new orders AFTER connect
      supabase.channel('fanefem-orders').on('postgres_changes',{event:'INSERT',schema:'public',table:'orders'}, async (payload)=>{
        console.log('NEW ORDER INSERT', payload.new.id);
        await notifyOrder(payload.new);
      }).subscribe();
      console.log('Subscribed to orders channel');
    }
  });
  sock.ev.on('messages.upsert', async ({messages})=>{
    for(const m of messages){
      if(!m.message||m.key.fromMe) continue;
      const from=m.key.remoteJid;
      const text=m.message.conversation||m.message.extendedTextMessage?.text||'';
      const lower=text.toLowerCase();
      if(lower.includes('order')||lower.includes('where')) await sock.sendMessage(from,{text:'3dafem Your order is processing. Rider will call you soon. Track at fanefem.com'});
      else if(lower.includes('shop')||lower.includes('sell')) await sock.sendMessage(from,{text:'Sell on Fanefem: fanefem.com/login - Free shop, instant money'});
      else if(lower.includes('hi')||lower.includes('hello')) await sock.sendMessage(from,{text:'Akwaaba to Fanefem. Buy at fanefem.com. Type ORDER to track, SHOP to sell. 3dafem'});
    }
  });
}
startBot();
console.log('Fanefem FINAL bot starting...');
