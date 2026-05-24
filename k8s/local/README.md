# Local Kubernetes deployment (Kind)

Runs the whole stack — Postgres, Kafka (KRaft), the indexer and notification
services, a mailpit SMTP sink, and the frontend — on a local
[Kind](https://kind.sigs.k8s.io/) cluster behind ingress-nginx.

## Prerequisites

`docker`, `kind`, `kubectl`.

## 1. Create the cluster

```bash
kind create cluster --name dex --config k8s/local/kind-config.yaml
```

## 2. Install ingress-nginx

```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/kind/deploy.yaml
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=120s
```

## 3. Build the images and load them into Kind

The Deployments use `*:local` images with `imagePullPolicy: IfNotPresent`, so
they must exist in the cluster's node. Build from the repo root:

```bash
docker build -f backend/Dockerfile.indexer      -t dex-indexer:local      backend
docker build -f backend/Dockerfile.notification -t dex-notification:local backend
docker build -f frontend/Dockerfile \
  --build-arg NEXT_PUBLIC_API_URL=http://dex.localhost/api/v2 \
  -t dex-frontend:local frontend

kind load docker-image --name dex dex-indexer:local dex-notification:local dex-frontend:local
```

## 4. Provide secrets

Edit the placeholder values in `10-config-and-secret.yaml` (the `dex-secret`
section — Alchemy RPC URLs and DB password), or create the secret out-of-band:

```bash
kubectl -n multichain-dex create secret generic dex-secret \
  --from-literal=DB_PASSWORD=dex_password \
  --from-literal=SEPOLIA_RPC_URL='https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY' \
  --from-literal=POLYGON_RPC_URL='https://polygon-amoy.g.alchemy.com/v2/YOUR_KEY' \
  --from-literal=MAIL_USERNAME='' --from-literal=MAIL_PASSWORD=''
```

## 5. Apply the manifests

Files are numbered for ordering; applying the directory works because Kubernetes
reconciles dependencies asynchronously:

```bash
kubectl apply -f k8s/local/
kubectl -n multichain-dex get pods -w
```

## 6. Access

Add a hosts entry, then open the app:

```bash
echo "127.0.0.1 dex.localhost" | sudo tee -a /etc/hosts
open http://dex.localhost           # frontend
# REST API:        http://dex.localhost/api/v2/health
# Mailpit web UI:  kubectl -n multichain-dex port-forward svc/mailpit 8025:8025
```

## Teardown

```bash
kind delete cluster --name dex
```

## Notes

- **Kafka** runs single-node in KRaft mode (no ZooKeeper); the broker advertises
  `kafka:9092` so the indexer (producer) and notification service (consumer)
  reach it via the `kafka` Service.
- The **notification** service exposes no HTTP port — it is a pure Kafka
  consumer, so it has no Service and uses a process-based liveness probe.
- `NEXT_PUBLIC_*` values are compiled into the frontend bundle, so the API URL is
  fixed at image build time (step 3), not at runtime.
