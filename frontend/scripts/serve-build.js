const fs = require('fs');
const http = require('http');
const path = require('path');
const { URL } = require('url');

const args = process.argv.slice(2);
let host = '127.0.0.1';
let port = 6010;

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === '--host') {
    host = args[++i];
  } else if (arg === '--port') {
    port = Number(args[++i]);
  } else {
    console.error(`Unknown argument: ${arg}`);
    process.exit(1);
  }
}

if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error(`Invalid port: ${port}`);
  process.exit(1);
}

const rootDir = path.resolve(__dirname, '..', 'build');
const indexFile = path.join(rootDir, 'index.html');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const sendFile = (res, filePath, method) => {
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
  });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  fs.createReadStream(filePath).pipe(res);
};

const server = http.createServer((req, res) => {
  if (!req.url) {
    res.writeHead(400);
    res.end('Missing request URL');
    return;
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end('Method Not Allowed');
    return;
  }

  const pathname = new URL(req.url, 'http://localhost').pathname;
  const decodedPath = decodeURIComponent(pathname);
  const candidatePath = path.normalize(path.join(rootDir, decodedPath));
  const safePath = candidatePath.startsWith(rootDir) ? candidatePath : indexFile;

  const serveCandidate = () => {
    fs.stat(safePath, (error, stats) => {
      if (!error && stats.isFile()) {
        sendFile(res, safePath, req.method);
        return;
      }

      fs.stat(indexFile, (indexError, indexStats) => {
        if (indexError || !indexStats.isFile()) {
          res.writeHead(500);
          res.end('Missing build/index.html');
          return;
        }
        sendFile(res, indexFile, req.method);
      });
    });
  };

  if (safePath !== indexFile) {
    fs.stat(safePath, (error, stats) => {
      if (!error && stats.isDirectory()) {
        const nestedIndex = path.join(safePath, 'index.html');
        fs.stat(nestedIndex, (nestedError, nestedStats) => {
          if (!nestedError && nestedStats.isFile()) {
            sendFile(res, nestedIndex, req.method);
            return;
          }
          serveCandidate();
        });
        return;
      }
      serveCandidate();
    });
    return;
  }

  serveCandidate();
});

server.listen(port, host, () => {
  console.log(`Serving ${rootDir} at http://${host}:${port}`);
});
