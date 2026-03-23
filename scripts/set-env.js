/**
 * set-env.js
 * Lee frontend/.env y reemplaza los placeholders ${VARIABLE} en los environment files.
 * Los archivos en git muestran referencias; los valores reales solo existen en .env local.
 * Ejecutar antes del build: npm run set-env
 */

const fs = require('fs');
const path = require('path');

// ── Parsear .env (local) o process.env (CI/CD) ───────────────────────────────
function parseEnv(filePath) {
  // En CI/CD (Vercel, Render, GitHub Actions) no hay .env — usar process.env
  if (!fs.existsSync(filePath)) {
    console.log('ℹ️   Archivo .env no encontrado — usando variables de process.env (modo CI).');
    return {
      API_URL:         process.env['API_URL']         || '',
      GEOAPIFY_API_KEY: process.env['GEOAPIFY_API_KEY'] || '',
      GOOGLE_CLIENT_ID: process.env['GOOGLE_CLIENT_ID'] || '',
      FACEBOOK_APP_ID:  process.env['FACEBOOK_APP_ID']  || '',
    };
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const vars = {};

  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '');
    vars[key] = value;
  });

  return vars;
}

// ── Sustituir placeholders ${VAR} en un archivo ───────────────────────────────
function applyEnv(filePath, vars) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌  Archivo no encontrado: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');

  content = content.replace(/\$\{([^}]+)\}/g, (_, key) => {
    if (vars[key] === undefined) {
      console.warn(`⚠️   Variable no encontrada en .env: ${key}`);
      return '';
    }
    return vars[key];
  });

  fs.writeFileSync(filePath, content, 'utf8');
}

// ── Main ──────────────────────────────────────────────────────────────────────
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
const envDir  = path.join(rootDir, 'src', 'environments');

const vars = parseEnv(envPath);

applyEnv(path.join(envDir, 'environment.ts'), vars);
applyEnv(path.join(envDir, 'environment.prod.ts'), vars);

console.log('✅  Variables de .env aplicadas a los environment files.');
console.log('    (no commitear los environment files con valores reales)');
