export interface ServiceConfig {
  /** Route prefix to match, e.g. "/api/users" */
  pathPrefix: string;
  /** Upstream target URL, e.g. "http://user-service:3001" */
  target: string;
}

const env = (key: string, fallback: string): string => process.env[key] ?? fallback;

export const PORT = parseInt(env('PORT', '3001'), 10);
export const CORS_ORIGIN = env('CORS_ORIGIN', 'http://localhost:3000');

export const SERVICES: ServiceConfig[] = [
  { pathPrefix: '/api/users',        target: env('USER_SERVICE_URL',        'http://user-service:3010') },
  { pathPrefix: '/api/auth',         target: env('USER_SERVICE_URL',        'http://user-service:3010') },
  { pathPrefix: '/api/addresses',    target: env('USER_SERVICE_URL',        'http://user-service:3010') },
  { pathPrefix: '/api/artists',      target: env('ARTIST_SERVICE_URL',      'http://artist-service:3002') },
  { pathPrefix: '/api/shops',        target: env('ARTIST_SERVICE_URL',      'http://artist-service:3002') },
  { pathPrefix: '/api/products',     target: env('CATALOG_SERVICE_URL',     'http://catalog-service:3003') },
  { pathPrefix: '/api/categories',   target: env('CATALOG_SERVICE_URL',     'http://catalog-service:3003') },
  { pathPrefix: '/api/tags',         target: env('CATALOG_SERVICE_URL',     'http://catalog-service:3003') },
  { pathPrefix: '/api/favorites',    target: env('INTERACTION_SERVICE_URL', 'http://interaction-service:3004') },
  { pathPrefix: '/api/reviews',      target: env('INTERACTION_SERVICE_URL', 'http://interaction-service:3004') },
  { pathPrefix: '/api/orders',       target: env('ORDER_SERVICE_URL',       'http://order-service:3005') },
  { pathPrefix: '/api/cart',         target: env('CART_SERVICE_URL',        'http://cart-service:3006') },
  { pathPrefix: '/api/payments',     target: env('PAYMENT_SERVICE_URL',     'http://payment-service:3007') },
];
