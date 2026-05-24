#!/usr/bin/env bash
#
# dev-up.sh — поднимает весь стек Multi-Chain DEX в локальном кластере Kind.
#
# Идемпотентно: повторный запуск переиспользует кластер и просто пере-применяет
# манифесты / пере-собирает образы.
#
# Использование:
#   ./scripts/dev-up.sh                       # полный прогон (build + deploy)
#   SEPOLIA_RPC_URL=... POLYGON_RPC_URL=... ./scripts/dev-up.sh   # со своими RPC-ключами
#   ./scripts/dev-up.sh --skip-build          # не пересобирать образы (только манифесты)
#
# Требуется: docker, kind, kubectl.
set -euo pipefail

# ── Параметры ────────────────────────────────────────────────────────────────
CLUSTER="dex"
NS="multichain-dex"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
K8S_DIR="$ROOT/k8s/local"
API_URL="http://dex.localhost/api/v2"
INGRESS_MANIFEST="https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml"

SKIP_BUILD="false"
[[ "${1:-}" == "--skip-build" ]] && SKIP_BUILD="true"

# ── Утилиты вывода ───────────────────────────────────────────────────────────
say()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$*"; }
ok()   { printf "  \033[1;32m✓\033[0m %s\n" "$*"; }
warn() { printf "  \033[1;33m!\033[0m %s\n" "$*"; }

# ── 0. Проверка инструментов ─────────────────────────────────────────────────
say "Проверка инструментов"
for tool in docker kind kubectl; do
  command -v "$tool" >/dev/null 2>&1 || { echo "ОШИБКА: не найден '$tool'. Установите его и повторите."; exit 1; }
  ok "$tool"
done

# ── 1. Кластер Kind ──────────────────────────────────────────────────────────
say "Кластер Kind '$CLUSTER'"
if kind get clusters 2>/dev/null | grep -qx "$CLUSTER"; then
  ok "кластер уже существует — переиспользуем"
else
  kind create cluster --name "$CLUSTER" --config "$K8S_DIR/kind-config.yaml"
  ok "кластер создан"
fi
kubectl config use-context "kind-$CLUSTER" >/dev/null

# ── 2. Ingress-NGINX ─────────────────────────────────────────────────────────
say "Ingress-NGINX"
kubectl apply -f "$INGRESS_MANIFEST"
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=180s
ok "контроллер ingress готов"

# ── 3. Сборка образов и загрузка в Kind ──────────────────────────────────────
if [[ "$SKIP_BUILD" == "true" ]]; then
  warn "--skip-build: пропускаю сборку образов"
else
  say "Сборка образов (indexer / notification / frontend)"
  docker build -f "$ROOT/backend/Dockerfile.indexer"      -t dex-indexer:local      "$ROOT/backend"
  docker build -f "$ROOT/backend/Dockerfile.notification" -t dex-notification:local "$ROOT/backend"
  docker build -f "$ROOT/frontend/Dockerfile" \
    --build-arg NEXT_PUBLIC_API_URL="$API_URL" \
    -t dex-frontend:local "$ROOT/frontend"
  ok "образы собраны"

  say "Загрузка образов в кластер (kind load)"
  kind load docker-image --name "$CLUSTER" dex-indexer:local dex-notification:local dex-frontend:local
  ok "образы загружены"
fi

# ── 4. Манифесты ─────────────────────────────────────────────────────────────
say "Применение манифестов k8s/local/"
kubectl apply -f "$K8S_DIR/"
ok "манифесты применены"

# ── 4a. Секрет с реальными RPC-ключами (если заданы) ─────────────────────────
if [[ -n "${SEPOLIA_RPC_URL:-}" || -n "${POLYGON_RPC_URL:-}" ]]; then
  say "Перезапись Secret реальными RPC-ключами из окружения"
  kubectl -n "$NS" create secret generic dex-secret \
    --from-literal=DB_PASSWORD="${DB_PASSWORD:-dex_password}" \
    --from-literal=SEPOLIA_RPC_URL="${SEPOLIA_RPC_URL:-}" \
    --from-literal=POLYGON_RPC_URL="${POLYGON_RPC_URL:-}" \
    --from-literal=MAIL_USERNAME="${MAIL_USERNAME:-}" \
    --from-literal=MAIL_PASSWORD="${MAIL_PASSWORD:-}" \
    --dry-run=client -o yaml | kubectl apply -f -
  kubectl -n "$NS" rollout restart deployment/indexer >/dev/null 2>&1 || true
  ok "Secret обновлён, indexer перезапущен"
else
  warn "SEPOLIA_RPC_URL/POLYGON_RPC_URL не заданы — используются плейсхолдеры из манифеста"
  warn "(индексатор будет ходить на публичный demo-endpoint c жёсткими лимитами)"
fi

# ── 5. Ожидание готовности ───────────────────────────────────────────────────
say "Ожидание готовности подов (это займёт минуту-две)"
kubectl -n "$NS" rollout status statefulset/postgres --timeout=180s || true
kubectl -n "$NS" rollout status statefulset/kafka     --timeout=180s || true
kubectl -n "$NS" rollout status deployment/indexer      --timeout=240s || true
kubectl -n "$NS" rollout status deployment/notification --timeout=180s || true
kubectl -n "$NS" rollout status deployment/frontend     --timeout=180s || true

# ── 6. Итог ──────────────────────────────────────────────────────────────────
say "Готово ✅  Текущее состояние:"
kubectl -n "$NS" get pods

cat <<EOF

──────────────────────────────────────────────────────────────────────────────
Доступ:
  1) Добавьте в /etc/hosts (один раз):
       echo "127.0.0.1 dex.localhost" | sudo tee -a /etc/hosts
  2) Приложение:     http://dex.localhost
     REST API:       http://dex.localhost/api/v2/health
  3) Письма (Mailpit):
       kubectl -n $NS port-forward svc/mailpit 8025:8025
       → http://localhost:8025

Полезное:
  Логи индексатора:  kubectl -n $NS logs -f deploy/indexer
  Перезапуск:        ./scripts/dev-up.sh --skip-build
  Снести кластер:    kind delete cluster --name $CLUSTER
──────────────────────────────────────────────────────────────────────────────
EOF
