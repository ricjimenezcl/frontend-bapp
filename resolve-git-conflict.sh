#!/bin/bash

echo "🔍 Estado actual:"
git status

echo ""
echo "📥 Haciendo pull con rebase..."
git pull --rebase origin release-frontapp

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Rebase exitoso"
  echo ""
  echo "📤 Haciendo push..."
  git push origin release-frontapp
  
  if [ $? -eq 0 ]; then
    echo ""
    echo "✅ ¡Push exitoso! Cambios subidos correctamente."
  else
    echo ""
    echo "❌ Error en el push. Revisa el mensaje arriba."
  fi
else
  echo ""
  echo "⚠️ Hubo conflictos en el rebase."
  echo "Opciones:"
  echo "  1. Resolver conflictos manualmente y ejecutar: git rebase --continue"
  echo "  2. Cancelar el rebase: git rebase --abort"
fi
