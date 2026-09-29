#!/bin/bash
# Ставит зависимости в облачной сессии Claude Code, чтобы сразу работали
# lint, typecheck, Jest/Vitest и гарды: corpus.test.ts, registry.test.ts, test:db.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# npm install, а не npm ci: состояние контейнера кешируется после хука,
# и повторный запуск только досинхронизирует изменения.
for pkg in talentia-mobile talentia-ai-proxy-next supabase; do
  npm install --prefix "$pkg" --no-audit --no-fund --loglevel=error --update-notifier=false
done
