import http from 'node:http';
import { ProxyRouter } from './proxy';
import { logger } from './logger';
import { SERVICES, PORT, CORS_ORIGIN } from './config';

const proxy = new ProxyRouter(SERVICES);

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Health check
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // Proxy to matching service
  const handled = proxy.route(req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found', message: `No service matches ${req.url}` }));
  }
});

server.listen(PORT, () => {
  logger.info(`API Gateway listening on port ${PORT}`);
  logger.info('Registered routes:');
  for (const svc of SERVICES) {
    logger.info(`  ${svc.pathPrefix} -> ${svc.target}`);
  }
});
