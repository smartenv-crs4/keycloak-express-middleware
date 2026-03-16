# Testing Environment and Scripts

Technical guide for preparing the test environment, installing dependencies, and running test scripts.

## Scope

This document describes the operational workflow for testing `keycloak-express-middleware`:

- local environment setup
- dependency installation
- test configuration files
- root and test script execution

For test architecture and internals, see [Testing Guide](testing.md).

## Prerequisites

- Node.js 18+
- npm 9+
- Docker and Docker Compose (for local Keycloak)
- Optional: SSH access if using remote Keycloak deployment workflow

## Environment Setup

### 1. Clone and open repository

```bash
git clone <repo-url>
cd keycloak-express-middleware
```

### 2. Install root dependencies

```bash
npm install
```

### 3. Install test workspace dependencies

```bash
npm --prefix test install
```

Note: the root `npm test` script also runs test workspace installation automatically.

### 4. Create local secrets file

```bash
cp test/config/secrets.json.example test/config/secrets.json
```

Then set local credentials in `test/config/secrets.json`.

### 5. Configure Keycloak base URL

Option A: use setup script

```bash
npm run setup-keycloak
```

Option B: set manually in `test/config/default.json` and/or `test/config/local.json`.

## Configuration Model

Configuration loading is environment-based and managed by `propertiesmanager`:

- `test/config/default.json` (committed defaults)
- `test/config/secrets.json` (git-ignored secrets)
- `test/config/local.json` (optional git-ignored machine overrides)

During tests, `NODE_ENV=test` is enforced by scripts.

## Script Catalog

### Root scripts (`package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm test` | `NODE_ENV=test node test/helpers/keycloak-setup.js && npm --prefix test install && npm --prefix test test` | Full test pipeline from root |
| `npm run setup-keycloak` | `NODE_ENV=test node test/docker-keycloak/setup-keycloak.js` (with ssh-agent helper) | Interactive Keycloak setup/deployment |

### Test workspace scripts (`test/package.json`)

| Script | Command | Purpose |
|--------|---------|---------|
| `npm --prefix test test` | `NODE_ENV=test PROPERTIES_PATH=./config mocha --require support/setup.js --exit` | Run all Mocha tests with global setup |

## Typical Workflows

### Quick local validation

```bash
npm install
npm test
```

### Start from clean machine

```bash
npm install
cp test/config/secrets.json.example test/config/secrets.json
npm --prefix test install
npm run setup-keycloak
npm test
```

### Run specific tests only

```bash
npm --prefix test test -- --grep "loginPKCE"
npm --prefix test test -- test/oidc-methods.test.js
```

## Script Execution Notes

- `npm test` triggers `test/helpers/keycloak-setup.js` before Mocha starts.
- The setup phase initializes runtime context and attempts Keycloak feature enablement.
- If Keycloak is unavailable, some integration behavior can be skipped based on test guards.

## CI/CD Notes

- Prefer non-interactive Keycloak provisioning in CI.
- Ensure `test/config/secrets.json` equivalent values are injected through secure CI secrets.
- Keep `NODE_ENV=test` and `PROPERTIES_PATH=./config` consistent with local workflow.

## Troubleshooting Quick List

### `Cannot find module ...`

```bash
npm install
npm --prefix test install
```

### TLS/self-signed cert issues

Use self-signed certs only for local/test environments and ensure local trust strategy is aligned with your setup.

### Keycloak not reachable

Verify `baseUrl` in test config and confirm container/server availability before running integration-heavy scenarios.
