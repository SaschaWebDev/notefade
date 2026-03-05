#!/usr/bin/env bash
set -euo pipefail

# Install dependencies with locked versions
yarn install --frozen-lockfile

# Copy .env.development → .env if .env doesn't exist
# (needed for wrangler config generation)
if [ ! -f .env ]; then
  cp .env.development .env
  echo "Copied .env.development → .env"
fi

# Generate wrangler.toml from template
yarn worker:config
