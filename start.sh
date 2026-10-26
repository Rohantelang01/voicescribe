#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=========================================================="
echo "🎙️  Starting VoiceScribe (Local FFmpeg & Cloud AI)  🎙️"
echo "=========================================================="

PORT=3000

# Open browser after a brief delay
(sleep 2 && xdg-open "http://localhost:${PORT}" 2>/dev/null || true) &

# Run development server (prefer pnpm if available, otherwise npm)
if command -v pnpm &> /dev/null; then
  pnpm dev -p ${PORT}
else
  npm run dev -- -p ${PORT}
fi
