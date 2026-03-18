#!/usr/bin/env node

/**
 * Ensures local test configuration files exist with valid defaults.
 *
 * Generated files (if missing):
 * - test/config/secrets.json
 * - test/docker-keycloak/.env
 *
 * Usage:
 *   node test/helpers/ensure-test-config.js
 *   node test/helpers/ensure-test-config.js --regenerate
 */

const fs = require('fs');
const path = require('path');

const force = process.argv.includes('--regenerate');

const repoRoot = path.join(__dirname, '..', '..');
const secretsPath = path.join(repoRoot, 'test', 'config', 'secrets.json');
const dockerEnvPath = path.join(repoRoot, 'test', 'docker-keycloak', '.env');

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_err) {
    return null;
  }
}

function writeJson(filePath, data) {
  ensureDir(filePath);
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function ensureSecrets() {
  const defaults = {
    test: {
      keycloak: {
        adminPassword: 'admin',
        clientSecret: 'test-client-secret',
        testPassword: 'test-password'
      }
    }
  };

  if (!fs.existsSync(secretsPath) || force) {
    writeJson(secretsPath, defaults);
    console.log(`[ensure-test-config] ${force ? 'Regenerated' : 'Created'} test/config/secrets.json`);
    return;
  }

  const current = readJsonSafe(secretsPath);
  if (!current) {
    writeJson(secretsPath, defaults);
    console.log('[ensure-test-config] Repaired invalid test/config/secrets.json');
    return;
  }

  const merged = {
    ...current,
    test: {
      ...(current.test || {}),
      keycloak: {
        ...defaults.test.keycloak,
        ...((current.test && current.test.keycloak) || {})
      }
    }
  };

  // Update only if required keys are missing.
  const currentString = JSON.stringify(current);
  const mergedString = JSON.stringify(merged);
  if (currentString !== mergedString) {
    writeJson(secretsPath, merged);
    console.log('[ensure-test-config] Added missing keys in test/config/secrets.json');
  } else {
    console.log('[ensure-test-config] test/config/secrets.json already valid');
  }
}

function ensureDockerEnv() {
  const content = [
    'KEYCLOAK_CERT_PATH=./certs',
    'KEYCLOAK_HOSTNAME=localhost'
  ].join('\n') + '\n';

  if (!fs.existsSync(dockerEnvPath) || force) {
    ensureDir(dockerEnvPath);
    fs.writeFileSync(dockerEnvPath, content, 'utf8');
    console.log(`[ensure-test-config] ${force ? 'Regenerated' : 'Created'} test/docker-keycloak/.env`);
    return;
  }

  const existing = fs.readFileSync(dockerEnvPath, 'utf8');
  if (!existing.includes('KEYCLOAK_CERT_PATH=') || !existing.includes('KEYCLOAK_HOSTNAME=')) {
    fs.writeFileSync(dockerEnvPath, content, 'utf8');
    console.log('[ensure-test-config] Repaired test/docker-keycloak/.env');
  } else {
    console.log('[ensure-test-config] test/docker-keycloak/.env already valid');
  }
}

function main() {
  ensureSecrets();
  ensureDockerEnv();
}

main();
