#!/usr/bin/env bash
# MyTerminal Tux Tux - Script de Inicio Rápido
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "🐧 Iniciando MyTerminal Tux Tux..."
npx electron . "$@"

