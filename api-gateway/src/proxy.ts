import http from 'node:http';
import { createProxyMiddleware, type RequestHandler } from 'http-proxy-middleware';
import type { ServiceConfig } from './config';
import { logger } from './logger';

export class ProxyRouter {
  private routes: { prefix: string; handler: RequestHandler<http.IncomingMessage, http.ServerResponse> }[] = [];

  constructor(services: ServiceConfig[]) {
    for (const svc of services) {
      this.routes.push({
        prefix: svc.pathPrefix,
        handler: createProxyMiddleware({
          target: svc.target,
          changeOrigin: true,
          on: {
            proxyReq: (
              _proxyReq: http.ClientRequest,
              req: http.IncomingMessage,
            ) => {
              logger.info(`→ ${req.method} ${req.url} -> ${svc.target}`);
            },
            error: (
              err: Error,
              req: http.IncomingMessage,
              res: http.ServerResponse | import('node:net').Socket,
            ) => {
              logger.error(`Proxy error for ${req.url}: ${err.message}`);
              if (res && 'writeHead' in res) {
                (res as http.ServerResponse).writeHead(502, { 'Content-Type': 'application/json' });
                (res as http.ServerResponse).end(JSON.stringify({ error: 'Bad Gateway', message: err.message }));
              }
            },
          },
        }),
      });
    }
  }

  route(req: http.IncomingMessage, res: http.ServerResponse): boolean {
    const url = req.url ?? '/';
    for (const r of this.routes) {
      if (url.startsWith(r.prefix)) {
        r.handler(req, res, () => {});
        return true;
      }
    }
    return false;
  }
}
