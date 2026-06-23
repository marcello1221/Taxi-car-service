#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build:shared
cp -R packages/shared/dist/* deploy/web/shared/
echo "Standalone web package ready in deploy/web"
