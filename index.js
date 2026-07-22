// FANEFEM WHATSAPP BOT - Deploy on Railway
// npm install whatsapp-web.js qrcode-terminal @supabase/supabase-js
import pkg from 'whatsapp-web.js'
const { Client, LocalAuth } = pkg
import qrcode from 'qrcode-terminal'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)

const client = new Client({ authStrategy: new LocalAuth() })

client.on('qr', qr => { qrcode.generate(qr, { small: true }) })
client.on('ready', () => { console.log('FANEFEM BOT READY - 3dafem!!!') })

client.on('message', async msg => {
  const body = msg.body.toLowerCase()
  const from = msg.from

  // Check if order exists for this phone
  const { data: orders } = await supabase.from('orders').select('*, traders(shop_name)').eq('buyer_phone', from.replace('@c.us','').slice(-10)).order('created_at',{ascending:false}).limit(1)

  if(body.includes('order') || body.includes('where') || body.includes('rider')){
    if(orders && orders[0]){
      await msg.reply(`3dafem!!! Your order from ${orders[0].traders.shop_name} is ${orders[0].status}. Rider: ${orders[0].rider_phone||'assigning...'} - Total: GHS ${orders[0].total}. Rider will call you soon. No stress!`)
    } else {
      await msg.reply('Welcome to Fanefem! Order from any shop at fanefem.com - Rider delivers free pickup. 3dafem!!! No stress selling.')
    }
  }

  if(body.includes('shop') || body.includes('sell') || body.includes('trader')){
    await msg.reply('Want to sell on Fanefem? Create free shop: https://fanefem-liveproduction1.vercel.app/login - You get money instantly, buyer pays delivery, rider picks up free. 3dafem!!! Activate Pro GHS 1.99/mo')
  }
})

client.initialize()

// Supabase Realtime - notify when new order comes
supabase.channel('orders').on('postgres_changes', { event:'INSERT', schema:'public', table:'orders' }, async payload => {
  const order = payload.new
  // Send to trader (you need trader whatsapp in DB)
  const { data: trader } = await supabase.from('traders').select('*').eq('id', order.trader_id).single()
  if(trader && trader.whatsapp_number){
    const traderJid = `233${trader.whatsapp_number.slice(-9)}@c.us`
    await client.sendMessage(traderJid, `3dafem!!! New order! Buyer: ${order.buyer_phone}, Address: ${order.buyer_address}, Total: GHS ${order.total}. Items: ${order.items.map(i=>i.name).join(', ')}. Rider coming to pickup free!`)
  }
}).subscribe()
