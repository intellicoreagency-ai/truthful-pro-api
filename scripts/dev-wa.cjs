// Local preview only: stands in for the customer/staff sending the WhatsApp verification message.
// Usage: node scripts/dev-wa.cjs <code shown on the sign-in screen> [phone, default 0501234567]
// Needs `wrangler dev` on :8788 and WA_APP_SECRET in api/.dev.vars (it signs the fake webhook like Meta would).
const crypto = require('crypto'); const fs = require('fs'); const path = require('path')
const vars = Object.fromEntries(fs.readFileSync(path.join(__dirname, '../api/.dev.vars'), 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const [code, phone = '0501234567'] = process.argv.slice(2)
if (!/^[A-Z0-9-]{4,16}$/i.test(code ?? '')) { console.error('Usage: node scripts/dev-wa.cjs <code> [phone]'); process.exit(1) }
const from = '971' + phone.replace(/\D/g, '').replace(/^(00971|971|0)/, '')
const raw = JSON.stringify({ entry: [{ changes: [{ value: { messages: [{ from, type: 'text', text: { body: code } }] } }] }] })
const sig = 'sha256=' + crypto.createHmac('sha256', vars.WA_APP_SECRET).update(raw).digest('hex')
fetch('http://localhost:8788/webhooks/whatsapp', { method: 'POST', headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' }, body: raw })
  .then((r) => console.log(r.ok ? `Delivered code ${code} from +${from}. The sign-in screen will continue in a few seconds.` : `Webhook answered ${r.status}`))
  .catch((e) => { console.error('Is `npx wrangler dev --port 8788` running?', e.message); process.exit(1) })
