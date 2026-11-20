// Tiny HTTPS-fronted bridge between the Worker and a ClamAV daemon (clamd). It never stores files.
// POST /scan  (Authorization: Bearer <SCANNER_TOKEN>, body = file bytes)  ->  {"status":"clean"|"infected"|"error"}
import http from 'node:http'
import net from 'node:net'
import crypto from 'node:crypto'

const TOKEN = process.env.SCANNER_TOKEN ?? ''
const CLAMD_HOST = process.env.CLAMD_HOST ?? '127.0.0.1'
const CLAMD_PORT = Number(process.env.CLAMD_PORT ?? 3310)
const PORT = Number(process.env.PORT ?? 8080)
const MAX = 6 * 1024 * 1024
if (TOKEN.length < 24) { console.error('SCANNER_TOKEN (>= 24 chars) is required'); process.exit(1) }

const safeEq = (a, b) => { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y) }

/** clamd INSTREAM protocol: "zINSTREAM\0", then [4-byte big-endian length][chunk]..., then a zero length. */
export function scanWithClamd(bytes, host = CLAMD_HOST, port = CLAMD_PORT) {
  return new Promise((resolve) => {
    const sock = net.connect({ host, port }); let out = ''; let done = false
    const finish = (v) => { if (!done) { done = true; sock.destroy(); resolve(v) } }
    sock.setTimeout(15000, () => finish('error'))
    sock.on('error', () => finish('error'))
    sock.on('data', (d) => { out += d.toString() })
    sock.on('end', () => finish(/FOUND\s*$/m.test(out.replace(/\0/g, '\n')) ? 'infected' : /OK\s*$/m.test(out.replace(/\0/g, '\n')) ? 'clean' : 'error'))
    sock.on('connect', () => {
      sock.write('zINSTREAM\0')
      for (let i = 0; i < bytes.length; i += 65536) { const chunk = bytes.subarray(i, i + 65536); const len = Buffer.alloc(4); len.writeUInt32BE(chunk.length); sock.write(len); sock.write(chunk) }
      sock.write(Buffer.alloc(4))
    })
  })
}

export const server = http.createServer(async (req, res) => {
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)) }
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true })
  if (req.method !== 'POST' || req.url !== '/scan') return send(404, { error: 'not_found' })
  const auth = req.headers.authorization ?? ''
  if (!auth.startsWith('Bearer ') || !safeEq(auth.slice(7), TOKEN)) return send(401, { error: 'unauthorized' })
  const chunks = []; let size = 0
  for await (const c of req) { size += c.length; if (size > MAX) { req.destroy(); return } chunks.push(c) }
  const status = await scanWithClamd(Buffer.concat(chunks))
  send(status === 'error' ? 502 : 200, { status })
})
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop())) server.listen(PORT, () => console.log('scanner bridge on', PORT))
