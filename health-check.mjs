#!/usr/bin/env node
/**
 * Script de vérification rapide de la santé des services
 * À lancer avant les tests E2E pour s'assurer que tout est prêt
 */

const services = [
  { name: 'Frontend', url: 'http://localhost:3000' },
  { name: 'User Service', url: 'http://localhost:3010/api/health' },
  { name: 'Artist Service', url: 'http://localhost:3002/api/health' },
  { name: 'Catalog Service', url: 'http://localhost:3003/api/health' },
  { name: 'Interaction Service', url: 'http://localhost:3004/health' },
  { name: 'Order Service', url: 'http://localhost:3005/api/health' },
  { name: 'Payment Service', url: 'http://localhost:3007/api/health' },
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bright: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function checkService(service) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(service.url, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json, text/plain, */*' }
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      log(`  ✓ ${service.name.padEnd(20)} → OK (${response.status})`, 'green');
      return true;
    } else {
      log(`  ✗ ${service.name.padEnd(20)} → HTTP ${response.status}`, 'red');
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      log(`  ✗ ${service.name.padEnd(20)} → Timeout (>5s)`, 'red');
    } else {
      log(`  ✗ ${service.name.padEnd(20)} → ${error.message}`, 'red');
    }
    return false;
  }
}

async function main() {
  log('\n╔══════════════════════════════════════════════════════════╗', 'cyan');
  log('║         CRAFTEA - Vérification des services             ║', 'bright');
  log('╚══════════════════════════════════════════════════════════╝', 'cyan');
  
  log('\nVérification de la disponibilité des services...\n', 'cyan');
  
  const results = await Promise.all(services.map(checkService));
  
  const available = results.filter(Boolean).length;
  const total = services.length;
  
  log('\n' + '─'.repeat(60), 'cyan');
  if (available === total) {
    log(`✓ Tous les services sont disponibles (${available}/${total})`, 'green');
    log('\nVous pouvez lancer les tests E2E :', 'cyan');
    log('  → node backend/test-e2e-complete.mjs', 'yellow');
    log('  → cd frontend && npm run test:e2e', 'yellow');
    process.exit(0);
  } else {
    log(`✗ ${total - available} service(s) indisponible(s) sur ${total}`, 'red');
    log('\nVeuillez démarrer les services manquants :', 'yellow');
    log('  → cd backend && docker-compose up -d', 'yellow');
    log('  → cd frontend && npm run dev', 'yellow');
    process.exit(1);
  }
}

main().catch(error => {
  log(`\nErreur fatale : ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});
