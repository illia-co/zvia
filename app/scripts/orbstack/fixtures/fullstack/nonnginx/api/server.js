const http = require('http')
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const port = Number(process.env.PORT || 4001)

async function checkDb() {
  const client = await pool.connect()
  try {
    await client.query('SELECT 1')
    return true
  } finally {
    client.release()
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    try {
      await checkDb()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', db: 'connected' }))
    } catch {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'degraded', db: 'disconnected' }))
    }
    return
  }

  if (req.url === '/' || req.url === '/api') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ service: 'zvia-nonnginx-api', note: 'no reverse proxy' }))
    return
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('Not found')
})

server.listen(port, '0.0.0.0', () => {
  console.log(`zvia-nonnginx-api listening on :${port}`)
})
