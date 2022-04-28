#!/usr/bin/env node
const log = console.log.bind(console)
const exists = obj => obj !== 'undefined'

const fs = require('fs'),
      url = require('url'),
      path = require('path'),
      Arrrg = require('arrrg'),
      watchify = require('watchify'),
      Transform = require('stream').Transform,
      Server = require('socket.io').Server,
      browserify = require('browserify')

const opts = Arrrg([
  { name: 'servn', type: String, command: true, swap: 'docroot', anon: false },
  { name: 'host', type: String, help: 'define the host' },
  { name: 'file', type: String, aliases: ['f'], help: 'define the entry file' },
  { name: 'entry', type: String, aliases: ['e'], help: 'define the entry path' },
  { name: 'port', type: Number, aliases: ['p'], help: 'define the port' },
  { name: 'index', type: String, aliases: ['i'], help: 'html file (index.html)' },
  { name: 'dir', type: String, aliases: ['d'], help: 'define the TLS cert directory' },
  { name: 'tls', type: b => b ? 'https' : 'http', aliases: ['s'], help: 'use tls', swap: 'proto' },
  { name: 'cert', type: String, aliases: ['c'], help: 'define the TLS cert' },
  { name: 'key', type: String, aliases: ['k'], help: 'define the TLS key' },
  { name: 'watch', type: String, aliases: ['w'], help: 'paths to watch', array: true },
  { name: 'help', type: Boolean, aliases: ['h', 'help'], help: 'show this dialog' },
], {
  docroot: process.env.DOCROOT || '.',
  host: process.env.HOST || 'localhost',
  port: process.env.PORT || 8080,
  tls: exists(process.env.TLS) ? process.env.TLS : false,
  dir: process.env.DIR || path.resolve(__dirname, '../../conf/certs'),
  file: process.env.FILE || 'main.js',
  entry: process.env.ENTRY || null,
  index: process.env.INDEX || 'index.html',
  cert: process.env.CERT || 'localhost.pem',
  key: process.env.KEY || 'localhost-key.pem',
  watch: process.env.WATCHERS || [],
}, [
  `servn`,
  `servn . -p 3000`,
  `servn ~/project --host example.com --file index.js`,
])
// log(opts)
if (opts.help) return opts.showHelp()

opts.entry = opts.entry || path.resolve(opts.docroot, opts.file)
opts.key = path.resolve(opts.dir, opts.key)
opts.cert = path.resolve(opts.dir, opts.cert)
opts.index = path.resolve(opts.docroot, opts.index)

opts.watch = fs.readdirSync(path.resolve(opts.docroot))
  .filter(f => ['js', 'html', 'css'].includes(f.split('.').pop()))
  .map(f => path.resolve(opts.docroot, f))
  .filter(f => f !== opts.entry)
  .concat(opts.watch.map(w => path.resolve(w)))
  
const mimeTypes = {
  '.css' : 'text/css',
  '.html': 'text/html',
  '.png' : 'image/png',
  '.wav' : 'audio/wav',
  '.jpg' : 'image/jpeg',
  '.mp3' : 'audio/mpeg',
  '.ico' : 'image/x-icon',
  '.svg' : 'image/svg+xml',
  '.js'  : 'text/javascript',
  '.pdf' : 'application/pdf',
  '.json': 'application/json',
  '.doc' : 'application/msword'
}

const { docroot, host, port, file: entryFile, entry, proto, watch, index: indexFile } = opts
const http = proto === 'http' ? require('http') : require('https')
const srvOpts = {}
if (proto === 'https') {
  srvOpts.cert = fs.readFileSync(opts.cert)
  srvOpts.key = fs.readFileSync(opts.key)
}
const server = http.createServer(srvOpts)
const io = new Server(server, { transports: ['websocket'] })
// io.on('connection', (socket) => { console.log('-- connected --') })

const b = browserify({
  entries: entry,
  cache: {},
  packageCache: {},
  debug: true,
  plugin: [watchify],
  paths: [__dirname + '/node_modules'],
  require: ['socket.io-client'],
}).on('error', console.error)

b.transform((file, opts) => {
  return new Transform({ transform (fileData, enc, cb) {
    if (file !== entry)
      return cb(null, fileData)
    for (const w of watch)
      this.emit('file', w)
    const data = `\n\n(function () {
      const { io } = require('socket.io-client')
      const socket = io("${proto}://${host}:${port}", { transports: ['websocket'] })
      // socket.on('connect', () => console.log('connected'))
      socket.on('bundle', () => window.location.reload())
    })()\n\n`
    fileData = Buffer.concat([Buffer.from(data), Buffer.from(fileData)])
    cb(null, fileData)
  }})
})

b.bundle().on('data', data => {}).on('end', () => {
  io.emit('bundle') // refresh browser
  b.on('update', () => {
    b.bundle()
    io.emit('bundle')
  })
})

server.on('request', (req, res) => {
  log(`${ req.method } ${ req.url }`)
  const parsedUrl = url.parse(req.url)
  let pathname = path.resolve(docroot, (`.${ parsedUrl.pathname }`)
    .replace(/\%2520/g, '%20')
    .replace(/^(\.)+/, '.')
    .replace(/(\/)$/, ''))
  const ext = path.parse(pathname).ext || '.html'
  if (req.url === '/bundle.js') {
    res.setHeader('content-type', 'application/javascript')
    return b.bundle().pipe(res)
  }
  if (!fs.existsSync(pathname)) {
    res.statusCode = 404
    return res.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Page Not Found</title> <meta name="viewport" content="width=device-width, initial-scale=1"><style>*{line-height: 1.2; margin: 0;}html{color: #888; display: table; font-family: sans-serif; height: 100%; text-align: center; width: 100%;}body{display: table-cell; vertical-align: middle; margin: 2em auto;}h1{color: #555; font-size: 2em; font-weight: 400;}p{margin: 0 auto; width: 280px;}@media only screen and (max-width: 280px){body, p{width: 95%;}h1{font-size: 1.5em; margin: 0 0 0.3em;}}</style></head><body><h1>Page Not Found</h1><p>Sorry, but the page you were trying to view does not exist.</p></body></html>`)
  }
  if (fs.statSync(pathname).isDirectory()) pathname += '/index' + ext
  // log('let us create', { pathname })
  fs.readFile(pathname, (err, data) => {
    if (err) {
      if (parsedUrl.pathname === '/') {
        // there is no default index.html, let's create one..
        res.setHeader('Content-type', 'text/html')
        return res.end(`<!doctype html><html><head><meta charset="utf-8"><title>Servn</title></head>
          <body style="background:#222;color:white;"><script src="bundle.js"></script>
            <h1>Servn</h1>
          </body></html>`)
      }
      res.statusCode = 500
      res.end(`Error getting the file: ${err}.`)
    } else {
      res.setHeader('Content-type', mimeTypes[ext] || 'text/plain' )
      res.end(data)
    }
  })
})

server.listen(parseInt(port), host, () => log(`\n<<< Server listening on ${proto}://${host}:${port} >>>\n`))
