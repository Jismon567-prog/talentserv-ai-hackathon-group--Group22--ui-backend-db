#!/usr/bin/env bash
# Push key=value pairs from a dotenv file into the linked Vercel project.
# Requires: vercel CLI logged in (vercel login) or VERCEL_TOKEN set, and vercel link.
set -euo pipefail

ENV_FILE="${1:-.env.vercel.local}"
TARGET="${2:-production}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing $ENV_FILE — copy from .env.vercel.example and add your keys." >&2
  exit 1
fi

if ! command -v vercel >/dev/null 2>&1; then
  echo "Install Vercel CLI: npm i -g vercel" >&2
  exit 1
fi

while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%%#*}"
  line="${line#"${line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"
  [[ -z "$line" ]] && continue
  name="${line%%=*}"
  value="${line#*=}"
  value="${value%\"}"
  value="${value#\"}"
  value="${value%\'}"
  value="${value#\'}"
  if [[ -z "$value" ]]; then
    echo "Skipping empty: $name"
    continue
  fi
  echo "Adding $name ($TARGET)..."
  printf '%s' "$value" | vercel env add "$name" "$TARGET" --force
done < "$ENV_FILE"

echo "Done. Run: vercel env pull .env.vercel.local --environment=$TARGET"
