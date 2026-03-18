#!/usr/bin/env node

/**
 * Keycloak Container Setup Script (allineato a keycloak-api-manager)
 *
 * Prompts user to choose local or remote deployment and configures Keycloak accordingly.
 *
 * Usage:
 *   npm run setup-keycloak
 *   node test/setup-keycloak.js
 */

const path = require('path');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const readline = require('readline');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function getDockerComposeCmdSync() {
  try {
    require('child_process').execSync('docker-compose --version', { stdio: 'ignore' });
    return 'docker-compose';
  } catch (err) {
    try {
      require('child_process').execSync('docker compose version', { stdio: 'ignore' });
      return 'docker compose';
    } catch (err2) {
      return null;
    }
  }
}

let DOCKER_COMPOSE_CMD = getDockerComposeCmdSync();
let rl;
function initReadline() {
  if (!rl) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY
    });
  }
  return rl;
}
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}
async function prompt(question) {
  return new Promise((resolve) => {
    const interface = initReadline();
    interface.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}
async function askDeploymentLocation() {
  log('\n=== Keycloak Container Deployment Setup ===\n', 'bright');
  log('Choose deployment location:', 'blue');
  const dockerAvailable = DOCKER_COMPOSE_CMD !== null;
  if (dockerAvailable) {
    log('  1) Local machine (localhost:8080)', 'yellow');
    log('  2) Remote machine via SSH', 'yellow');
  } else {
    log('  ⚠ Docker not available locally', 'yellow');
    log('  → Deploying to remote machine via SSH', 'yellow');
    return 'remote';
  }
  let choice;
  while (!['1', '2'].includes(choice)) {
    choice = await prompt('\nEnter choice (1 or 2): ');
    if (!['1', '2'].includes(choice)) {
      log('Invalid choice. Please enter 1 or 2.', 'red');
    }
  }
  return choice === '1' ? 'local' : 'remote';
}
async function askHttpsSetup() {
  log('\nEnable HTTPS?', 'blue');
  log('  1) No, use HTTP (development)', 'yellow');
  log('  2) Yes, use HTTPS (production-like)', 'yellow');
  let choice;
  while (!['1', '2'].includes(choice)) {
    choice = await prompt('\nEnter choice (1 or 2): ');
    if (!['1', '2'].includes(choice)) {
      log('Invalid choice. Please enter 1 or 2.', 'red');
    }
  }
  return choice === '2';
async function askRemoteDetails() {
  log('\nRemote Deployment Target', 'blue');
  log('  Specify the user and machine where Keycloak will be deployed:', 'yellow');
  log('  Format: username@hostname', 'yellow');
  log('  Example: user@miodomino.it', 'yellow');
  const host = await prompt('\nRemote host/IP (user@hostname): ');
  const keyFile = path.join(certPath, 'keycloak.key');
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    throw new Error(`Certificate files not found in ${certPath}\nExpected: keycloak.crt and keycloak.key`);
  }
  return { localPath: certPath, remotePath: null };
}
function executeCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd: cwd || process.cwd(),
      stdio: 'inherit',
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      }
    });
    child.on('error', (err) => {
      reject(err);
    });
  });
}
function execSync(command, cwd) {
  return new Promise((resolve, reject) => {
    const options = {};
    if (cwd) {
      options.cwd = cwd;
    }
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}
function updateTestBaseUrl(baseUrl) {
  const configPath = path.join(__dirname, '..', 'config', 'default.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  if (!config.test || !config.test.keycloak) {
    throw new Error('test.keycloak not found in test/config/default.json');
  }
  config.test.keycloak.baseUrl = baseUrl;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  log(`✓ Updated test baseUrl: ${baseUrl}`, 'green');
}
async function deployLocal(useHttps, certPath) {
  // ...identico al reference...
}
async function deployRemote(host, deployPath, useHttps, certPath) {
  // ...identico al reference, ma forzare deployPath = /home/smart/docker-keycloak-api-manager-test ...
}
async function main() {
  try {
    const deployLocation = await askDeploymentLocation();
    const useHttps = await askHttpsSetup();
    let certPath = null;
    if (useHttps) {
      const isRemote = deployLocation === 'remote';
      certPath = await askCertificatePath(isRemote);
    }
    if (deployLocation === 'local') {
      await deployLocal(useHttps, certPath);
      const protocol = useHttps ? 'https' : 'http';
      const port = useHttps ? 8443 : 8080;
      updateTestBaseUrl(`${protocol}://localhost:${port}`);
    } else {
      const { host } = await askRemoteDetails();
      // Path di deploy forzato come nel reference
      const deployPath = `/home/smart/docker-keycloak-api-manager-test`;
      log(`\n✓ Deployment path: ${deployPath}`, 'green');
      await deployRemote(host, deployPath, useHttps, certPath);
      const protocol = useHttps ? 'https' : 'http';
      const port = useHttps ? 8443 : 8080;
      const hostname = host.includes('@') ? host.split('@')[1] : host;
      updateTestBaseUrl(`${protocol}://${hostname}:${port}`);
    }
    log('\n✓ Deployment complete!\n', 'green');
  } catch (err) {
    log(`\nSetup failed: ${err.message}\n`, 'red');
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

async function prompt(question) {
  return new Promise((resolve) => {
    const interface = initReadline();
    interface.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

async function askDeploymentLocation() {
  log('\n=== Keycloak Container Deployment Setup ===\n', 'bright');
  log('Choose deployment location:', 'blue');
  
  const dockerAvailable = DOCKER_COMPOSE_CMD !== null;
  
  if (dockerAvailable) {
    log('  1) Local machine (localhost:8080)', 'yellow');
    log('  2) Remote machine via SSH', 'yellow');
  } else {
    log('  ⚠ Docker not available locally', 'yellow');
    log('  → Deploying to remote machine via SSH', 'yellow');
    return 'remote';
  }
  
  let choice;
  while (!['1', '2'].includes(choice)) {
    choice = await prompt('\nEnter choice (1 or 2): ');
    if (!['1', '2'].includes(choice)) {
      log('Invalid choice. Please enter 1 or 2.', 'red');
    }
  }
  
  return choice === '1' ? 'local' : 'remote';
}

async function askHttpsSetup() {
  log('\nEnable HTTPS?', 'blue');
  log('  1) No, use HTTP (development)', 'yellow');
  log('  2) Yes, use HTTPS (production-like)', 'yellow');
  let choice;
  while (!['1', '2'].includes(choice)) {
    choice = await prompt('\nEnter choice (1 or 2): ');
    if (!['1', '2'].includes(choice)) {
      log('Invalid choice. Please enter 1 or 2.', 'red');
    }
  }
  return choice === '2';
    
    log('✓ Certificates found', 'green');
  }
  
  return choice === '2';
}

async function askRemoteDetails() {
  log('\nRemote Deployment Target', 'blue');
  log('  Specify the user and machine where Keycloak will be deployed:', 'yellow');
  log('  Format: username@hostname', 'yellow');
  log('  Example: user@miodomino.it', 'yellow');
  
  const host = await prompt('\nRemote host/IP (user@hostname): ');
  if (!host) {
    throw new Error('Host is required');
  }
  return { host };
}

function executeCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn('bash', ['-c', command], {
      cwd: cwd || process.cwd(),
      stdio: 'inherit',
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}: ${command}`));
      }
    });
    
    child.on('error', (err) => {
      reject(err);
    });
  });
}

function execSync(command, cwd) {
  return new Promise((resolve, reject) => {
    const options = {};
    if (cwd) {
      options.cwd = cwd;
    }
    exec(command, options, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function updateTestBaseUrl(baseUrl) {
  const configPath = path.join(__dirname, '..', 'config', 'default.json');
  const raw = fs.readFileSync(configPath, 'utf8');
  const config = JSON.parse(raw);
  
  // PropertiesManager supports multiple environments: production, dev, test
  if (!config.test) {
    config.test = {};
  }
  if (!config.test.keycloak) {
    config.test.keycloak = {};
  }
  
  config.test.keycloak.baseUrl = baseUrl;
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  log(`✓ Updated test baseUrl: ${baseUrl}`, 'green');
}

async function deployLocal(useHttps) {
  log('\n=== Local Deployment ===\n', 'bright');
  
  const dockerComposeDir = __dirname;
  
  try {
    // Determine which compose file to use
    const composeFile = useHttps ? 'docker-compose-https.yml' : 'docker-compose.yml';
    const composeCmd = `docker-compose -f ${composeFile}`;
    
    if (useHttps) {
      log('Starting Keycloak with HTTPS...', 'blue');
    } else {
      log('Starting Keycloak with HTTP...', 'blue');
      
      // Remove .env file for HTTP (use defaults)
      const envFilePath = path.join(dockerComposeDir, '.env');
      if (fs.existsSync(envFilePath)) {
        fs.unlinkSync(envFilePath);
      }
      log('Using default HTTP configuration', 'green');
    }
    
    // Stop any existing containers
    log('Stopping existing containers...', 'blue');
    try {
      await executeCommand(`${composeCmd} down 2>/dev/null || true`, dockerComposeDir);
    } catch (err) {
      // Ignore errors
    }
    
    // Start containers
    log(`Starting Keycloak...`, 'blue');
    await executeCommand(`${composeCmd} up -d`, dockerComposeDir);
    log(`\n✓ Keycloak is starting locally...`, 'green');
    
    log('\nWaiting for Keycloak to be ready...', 'blue');
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!ready && attempts < maxAttempts) {
      try {
        const health = await execSync(`curl -s http://localhost:8080/health/ready 2>/dev/null`);
        if (health.includes('UP')) {
          ready = true;
        }
      } catch (err) {
        // Still waiting
      }
      
      if (!ready) {
        attempts++;
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    if (ready) {
      log('\n\n✓ Keycloak is ready!', 'green');
      log('\nAccess Keycloak:', 'bright');
      log(`  Admin Console: http://localhost:8080`, 'yellow');
      log('  Credentials: admin / admin', 'yellow');
    } else {
      log('\n\n⚠ Keycloak is taking longer than expected. Check Docker logs:', 'yellow');
      log(`  ${composeCmd} logs -f`, 'yellow');
    }
    
  } catch (err) {
    log(`\n✗ Error during local deployment: ${err.message}`, 'red');
    throw err;
  }
}

async function deployRemote(host, deployPath, useHttps) {
  const dockerComposeDir = __dirname;
  const dockerComposePath = path.join(dockerComposeDir, 'docker-compose.yml');
  const dockerComposeHttpsPath = path.join(dockerComposeDir, 'docker-compose-https.yml');
  const hostname = host.includes('@') ? host.split('@')[1] : host;
  // Generate local .env file (same approach as keycloak-api-manager)
  const envContent = `KEYCLOAK_CERT_PATH=./certs\nKEYCLOAK_HOSTNAME=${hostname}\n`;
  fs.writeFileSync(path.join(dockerComposeDir, '.env'), envContent);
  try {
    // Copia compose e .env
    await execSync(`scp "${dockerComposePath}" "${host}:${deployPath}/docker-compose.yml"`);
    await execSync(`scp "${dockerComposeHttpsPath}" "${host}:${deployPath}/docker-compose-https.yml"`);
    await execSync(`scp "${path.join(dockerComposeDir, '.env')}" "${host}:${deployPath}/.env"`);
    // Copia certificati
    log('Copying certificates to remote...', 'blue');
    const certDir = path.join(dockerComposeDir, 'certs');
    const certPath = path.join(certDir, 'keycloak.crt');
    const keyPath = path.join(certDir, 'keycloak.key');
    if (!fs.existsSync(certPath) || !fs.existsSync(keyPath)) {
      throw new Error(`Certificates not found in ${certDir}`);
    }
    await execSync(`ssh ${host} 'mkdir -p "${deployPath}/certs"'`);
    await execSync(`scp "${certPath}" "${host}:${deployPath}/certs/keycloak.crt"`);
    await execSync(`scp "${keyPath}" "${host}:${deployPath}/certs/keycloak.key"`);
    log('✓ Certificates copied and configured', 'green');
    // Compose command con --env-file
    const composeFile = useHttps ? 'docker-compose-https.yml' : 'docker-compose.yml';
    const composeCmd = DOCKER_COMPOSE_CMD ? `${DOCKER_COMPOSE_CMD} --env-file .env -f ${composeFile}` : `docker compose --env-file .env -f ${composeFile}`;
    // Stop any existing containers at the remote path
    log('Stopping existing containers...', 'blue');
    try {
      await execSync(`ssh ${host} 'cd "${deployPath}" && ${composeCmd} down 2>/dev/null || true'`);
      await execSync(`ssh ${host} 'docker rm -f keycloak-test 2>/dev/null || true'`);
    } catch (err) {
      // Ignore errors if containers don't exist
    }
    log('✓ Old containers stopped', 'green');
    // Start new containers
    log(`Starting Keycloak container...`, 'blue');
    await execSync(`ssh ${host} 'cd "${deployPath}" && ${composeCmd} up -d'`);
    log('✓ Keycloak container started', 'green');
    
    log('\nWaiting for Keycloak to be ready...', 'blue');
    let ready = false;
    let attempts = 0;
    const maxAttempts = 60;
    while (!ready && attempts < maxAttempts) {
      try {
        const checkCmd = `ssh ${host} 'curl -s http://localhost:8080/health/ready 2>/dev/null'`;
        const health = await execSync(checkCmd);
        if (health.includes('UP')) {
          ready = true;
        }
      } catch (err) {
        // Still waiting
      }
      if (!ready) {
        attempts++;
        process.stdout.write('.');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    if (ready) {
      log('\n\n✓ Keycloak is ready!', 'green');
      log('\nAccess Keycloak:', 'bright');
      log(`  Admin Console: https://${hostname}:8443`, 'yellow');
      log('  Credentials: admin / admin', 'yellow');
      log(`\nDeployed at: ${host}:${deployPath}`, 'yellow');

      // === PROVISION KEYCLOAK RESOURCES ===
      log('\nProvisioning Keycloak test realm, client, and user...', 'blue');
      try {
        // Run the provisioning script locally, targeting the remote Keycloak
        const { spawnSync } = require('child_process');
        const provision = spawnSync('node', [
          path.resolve(__dirname, '../helpers/keycloak-setup.js')
        ], {
          stdio: 'inherit',
          env: {
            ...process.env,
            BASE_URL: `https://${hostname}:8443`,
            NODE_ENV: 'test',
            PROPERTIES_PATH: path.resolve(__dirname, '../config')
          }
        });
        if (provision.status !== 0) {
          log('✗ Provisioning script failed. Check output above.', 'red');
        } else {
          log('✓ Provisioning complete.', 'green');
        }
      } catch (e) {
        log('✗ Error running provisioning script: ' + e.message, 'red');
      }
    } else {
      log('\n\n⚠ Keycloak is taking longer than expected. Logs:', 'yellow');
      log(`  ssh ${host} 'cd ${deployPath} && ${composeCmd} logs -f'`, 'yellow');
    }
  } catch (err) {
    log(`\n✗ Error during remote deployment: ${err.message}`, 'red');
    throw err;
  }
}

async function main() {
  try {
    const deployLocation = await askDeploymentLocation();
    const useHttps = await askHttpsSetup();
    
    if (deployLocation === 'local') {
      await deployLocal(useHttps);
      const protocol = useHttps ? 'https' : 'http';
      const port = useHttps ? 8443 : 8080;
      updateTestBaseUrl(`${protocol}://localhost:${port}`);
    } else {
      const { host } = await askRemoteDetails();
      // Extract username from host (format: user@host or just host)
      let username = 'root';
      if (host.includes('@')) {
        username = host.split('@')[0];
      }
      // Automatically create deployment path
      const deployPath = `/home/${username}/docker-keycloak-express-middleware-test`;
      log(`\n✓ Deployment path: ${deployPath}`, 'green');
      await deployRemote(host, deployPath, useHttps);
      const protocol = useHttps ? 'https' : 'http';
      const port = useHttps ? 8443 : 8080;
      const hostname = host.includes('@') ? host.split('@')[1] : host;
      updateTestBaseUrl(`${protocol}://${hostname}:${port}`);
    }
    
    log('\n✓ Setup complete!\n', 'green');

    // Test config bootstrap already creates local config files and test setup recreates realm/client.
    log('4. Run npm test to bootstrap test config and sync realm/client/user automatically.', 'yellow');
    log('   (test/helpers/ensure-test-config.js + test/helpers/keycloak-setup.js)', 'yellow');
    log('5. Only update test/config/secrets.json manually if you intentionally changed credentials.', 'yellow');
    log('   (adminPassword, clientSecret, testPassword)', 'yellow');
    
  } catch (err) {
    log(`\nSetup failed: ${err.message}\n`, 'red');
    process.exit(1);
  } finally {
    if (rl) {
      rl.close();
    }
  }
}

main();
