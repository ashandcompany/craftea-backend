// Force les variables d'environnement pour les tests d'intégration.
// En CI, ces variables sont déjà injectées par le workflow → ??= ne les écrase pas.
// En local, elles pointent vers le container de test (docker-compose.test.yml, port 5433).
process.env.NODE_ENV ??= 'test';
process.env.DB_HOST ??= 'localhost';
process.env.DB_PORT ??= '5433';
process.env.DB_USER ??= 'craftea';
process.env.DB_PASS ??= 'craftea';
process.env.DB_NAME ??= 'craftea_users';
process.env.JWT_SECRET ??= 'ci-test-jwt-secret-32chars-min!!';
process.env.JWT_REFRESH_SECRET ??= 'ci-test-refresh-secret-32chars!';
process.env.MINIO_ENDPOINT ??= 'localhost';
process.env.MINIO_PORT ??= '9001';
process.env.MINIO_ACCESS_KEY ??= 'minioadmin';
process.env.MINIO_SECRET_KEY ??= 'minioadmin';
process.env.MINIO_BUCKET ??= 'craftea-uploads';
process.env.RESEND_API_KEY ??= 're_test_dummy';
process.env.EMAIL_FROM ??= 'test@craftea.local';
process.env.INTERNAL_SERVICE_TOKEN ??= 'ci-internal-token';
