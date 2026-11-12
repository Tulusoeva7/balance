#!/bin/zsh
cd "${0:A:h}/.." || exit 1
if curl -fsS --max-time 2 http://127.0.0.1:5173/ >/dev/null && curl -fsS --max-time 2 http://127.0.0.1:5001/api/health >/dev/null; then
  open 'http://127.0.0.1:5173'
  exit 0
fi
if ! command -v npm >/dev/null; then
  echo 'Для запуска Balance нужен Node.js с npm.'
  read '?Нажмите Enter, чтобы закрыть окно.'
  exit 1
fi
(for attempt in {1..40}; do
  if curl -fsS --max-time 1 http://127.0.0.1:5173/ >/dev/null && curl -fsS --max-time 1 http://127.0.0.1:5001/api/health >/dev/null; then
    open 'http://127.0.0.1:5173'
    break
  fi
  sleep 1
done) &
npm run dev -- --port 5173 --strictPort
