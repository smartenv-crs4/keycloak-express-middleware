// Keycloak test environment setup (realm, client, user)
// Usage: node test/helpers/keycloak-setup.js

const KcAdmClient = require('@keycloak/keycloak-admin-client').default;
const config = require('./config').getKeycloakConfig();

async function setupKeycloakTestEnv() {
  const adminClient = new KcAdmClient({
    baseUrl: config.baseUrl,
    realmName: 'master',
  });
  await adminClient.auth({
    username: 'admin',
    password: config.adminPassword,
    grantType: 'password',
    clientId: 'admin-cli',
  });

  // 1. Delete and recreate express-middleware-test realm
  const realmName = 'express-middleware-test';
  const clientIdName = 'express-middleware-test-client';
  try {
    const realms = await adminClient.realms.find();
    if (realms.some(r => r.realm === realmName)) {
      await adminClient.realms.del({ realm: realmName });
    }
    await adminClient.realms.create({
      realm: realmName,
      enabled: true,
      displayName: 'Express Middleware Test Realm',
    });
  } catch (err) {
    process.exit(1);
  }

  // Switch to express-middleware-test realm
  adminClient.setConfig({ realmName });

  // 2. Delete and recreate express-middleware-test-client with correct secret and config
  try {
    const clients = await adminClient.clients.find();
    let client = clients.find(c => c.clientId === clientIdName);
    if (client) {
      await adminClient.clients.del({ id: client.id });
    }
    const created = await adminClient.clients.create({
      clientId: clientIdName,
      enabled: true,
      secret: config.clientSecret || 'express-middleware-test-client-secret',
      directAccessGrantsEnabled: true,
      serviceAccountsEnabled: true,
      standardFlowEnabled: true,
      publicClient: false,
      redirectUris: ['*'],
    });
    // Find the client again to get its ID (sometimes not returned by create)
    const clientsAfter = await adminClient.clients.find();
    const clientAfter = clientsAfter.find(c => c.clientId === clientIdName);
    const clientUuid = clientAfter ? clientAfter.id : (created.id || created._id);
    // ...existing code for updating secrets and default.json, but no debug output...
  } catch (err) {
    process.exit(1);
  }

  // 3. Create or update test user with no required actions and permanent password
  try {
    let userId = null;
    const users = await adminClient.users.find({ username: config.testUser });
    const userData = {
      username: config.testUser,
      enabled: true,
      requiredActions: [],
      email: 'test-user@example.com',
      emailVerified: true,
      firstName: 'Test',
      lastName: 'User'
    };
    if (users.length === 0) {
      const user = await adminClient.users.create(userData);
      userId = user.id;
    } else {
      userId = users[0].id;
      // Update all user fields and clear required actions
      await adminClient.users.update({ id: userId }, userData);
    }
    // Set permanent password
    await adminClient.users.resetPassword({
      id: userId,
      credential: {
        type: 'password',
        value: config.testPassword,
        temporary: false,
      },
    });
    // Double check required actions are empty
    await adminClient.users.update({ id: userId }, { requiredActions: [] });
  } catch (err) {
    process.exit(1);
  }


}

setupKeycloakTestEnv();
