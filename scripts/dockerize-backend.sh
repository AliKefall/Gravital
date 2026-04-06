#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/dockerize-backend.sh
#   IMAGE_NAME=gravital-backend:prod CONTAINER_NAME=gravital-backend ./scripts/dockerize-backend.sh
#   ENV_FILE=.env.docker HOST_PORT=8080 ./scripts/dockerize-backend.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_NAME="${IMAGE_NAME:-gravital-backend:latest}"
CONTAINER_NAME="${CONTAINER_NAME:-gravital-backend}"
ENV_FILE="${ENV_FILE:-.env.docker}"
HOST_PORT="${HOST_PORT:-8080}"

if ! command -v docker >/dev/null 2>&1; then
  echo "docker bulunamadi. Once Docker kurmalisin." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Env dosyasi bulunamadi: ${ENV_FILE}" >&2
  echo "Ornek icin scripts/docker-env.example dosyasini kopyalayabilirsin." >&2
  exit 1
fi

required_envs=(DATABASE_URL DB_AUTH_TOKEN JWT_SECRET)
for required in "${required_envs[@]}"; do
  if ! grep -qE "^${required}=" "${ENV_FILE}"; then
    echo "Eksik env: ${required} (${ENV_FILE} icine ekle)" >&2
    exit 1
  fi
done

echo "==> Docker image build ediliyor: ${IMAGE_NAME}"
docker build -t "${IMAGE_NAME}" -f Dockerfile .

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "==> Eski container kaldiriliyor: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "==> Container baslatiliyor: ${CONTAINER_NAME}"
docker run -d \
  --name "${CONTAINER_NAME}" \
  --restart unless-stopped \
  --env-file "${ENV_FILE}" \
  -p "${HOST_PORT}:8080" \
  "${IMAGE_NAME}" >/dev/null

echo "==> Tamamlandi"
echo "Container: ${CONTAINER_NAME}"
echo "Image:     ${IMAGE_NAME}"
echo "Port:      ${HOST_PORT}->8080"
echo
echo "Durum kontrol:"
echo "  docker ps --filter name=${CONTAINER_NAME}"
echo "  docker logs -f ${CONTAINER_NAME}"
