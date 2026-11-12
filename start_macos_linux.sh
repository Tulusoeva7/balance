#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo "Install Node.js 18 or newer first."; exit 1; }
command -v python3 >/dev/null 2>&1 || { echo "Install Python 3.10 or newer first."; exit 1; }
if [ ! -f node_modules/vite/bin/vite.js ]; then
  echo "Installing frontend dependencies..."
  npm install
fi
if [ ! -x backend/.venv/bin/python ]; then
  echo "Creating Python environment..."
  python3 -m venv backend/.venv
  backend/.venv/bin/python -m pip install -r backend/requirements.txt
fi
BALANCE_PYTHON=backend/.venv/bin/python npm run dev
