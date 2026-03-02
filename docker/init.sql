-- Création automatique des bases au démarrage du conteneur PostgreSQL
-- Ce script est exécuté une seule fois à l'initialisation du volume de données.

CREATE DATABASE craftea_users;
CREATE DATABASE craftea_artists;
CREATE DATABASE craftea_catalog;
CREATE DATABASE craftea_interactions;
CREATE DATABASE craftea_orders;
CREATE DATABASE craftea_carts;

-- Accorder tous les privilèges à l'utilisateur craftea
GRANT ALL PRIVILEGES ON DATABASE craftea_users TO craftea;
GRANT ALL PRIVILEGES ON DATABASE craftea_artists TO craftea;
GRANT ALL PRIVILEGES ON DATABASE craftea_catalog TO craftea;
GRANT ALL PRIVILEGES ON DATABASE craftea_interactions TO craftea;
GRANT ALL PRIVILEGES ON DATABASE craftea_orders TO craftea;
GRANT ALL PRIVILEGES ON DATABASE craftea_carts TO craftea;
