#!/bin/bash
# Script à exécuter UNE SEULE FOIS sur le serveur (Swarm manager)
# avant le premier déploiement.
#
# Usage : bash deploy/init-secrets.sh

set -euo pipefail

check_secret() {
  local name="$1"
  if docker secret inspect "$name" &>/dev/null; then
    echo "  [SKIP] $name existe déjà"
    return 0
  fi
  return 1
}

echo ""
echo "=== Initialisation des secrets Docker Swarm pour Craftea ==="
echo ""

# ── Stripe secret key ──────────────────────────────────────────────────────
if ! check_secret stripe_secret_key; then
  echo "Stripe secret key (sk_live_...) :"
  read -rs STRIPE_KEY
  echo ""
  printf '%s' "$STRIPE_KEY" | docker secret create stripe_secret_key -
  echo "  [OK] stripe_secret_key créé"
fi

# ── Stripe webhook secret ──────────────────────────────────────────────────
if ! check_secret stripe_webhook_secret; then
  echo "Stripe webhook secret (whsec_...) :"
  read -rs STRIPE_WEBHOOK
  echo ""
  printf '%s' "$STRIPE_WEBHOOK" | docker secret create stripe_webhook_secret -
  echo "  [OK] stripe_webhook_secret créé"
fi

echo ""
echo "=== Secrets créés ==="
docker secret ls
echo ""
echo "Tu peux maintenant lancer le premier deploy via GitHub Actions (push sur main)."
