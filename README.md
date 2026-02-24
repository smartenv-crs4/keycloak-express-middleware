
# 🔐 keycloak-express-middleware for Node.js (Express)

Middleware avanzato per l'integrazione di Keycloak in applicazioni Node.js/Express.

## Caratteristiche principali

- Supporto completo OIDC/OAuth2 (PKCE, Authorization Code, Client Credentials, Password, Refresh Token)
- Middleware Express per autenticazione, autorizzazione, enforcer UMA 2.0, gestione ruoli e permessi
- Helpers per login/logout, flussi custom, gestione sessioni e callback
- Compatibile con keycloak-connect e @keycloak/keycloak-admin-client
- Documentazione bilingue (IT/EN) e esempi pratici

## Installazione

```bash
npm install keycloak-express-middleware
```

## Utilizzo base

```js
const express = require('express');
const KeycloakAdapter = require('keycloak-express-middleware');

const app = express();
const keycloak = new KeycloakAdapter({
	authServerUrl: 'https://keycloak.example.com/',
	realmName: 'myrealm',
	clientId: 'myclient',
	clientSecret: 'secret',
});

app.use(keycloak.middleware());

app.get('/private', keycloak.protectMiddleware('admin'), (req, res) => {
	res.send('Area riservata agli admin!');
});

app.listen(3000);
```

## Documentazione

La documentazione completa (setup, configurazione, OIDC, test, troubleshooting, architettura) è in [docs/README.md](docs/README.md).

### Sezioni principali:
- **Setup e configurazione**: come integrare e configurare il middleware
- **Esempi di utilizzo**: snippet e best practice
- **Test e infrastruttura di test**: [docs/testing.md](docs/testing.md)
- **Troubleshooting**: risoluzione problemi comuni
- **Architettura**: overview moduli e flussi

## Testing

L'infrastruttura di test automatica è documentata in [docs/testing.md](docs/testing.md) e nella sezione "Test" della documentazione principale.

Per eseguire i test:

```bash
npm run setup-keycloak
npm test
```

## License

MIT License. Developed by CRS4 Microservice Core Team.

---

## Contributions

Contributions, issues and feature requests are welcome!

1. Fork the project
2. Create your feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a pull request

---

## Maintainers

Developed and maintained by [CRS4 Microservice Core Team](mailto:cmc.smartenv@crs4.it)

Design and development:
- Alessandro Romanino ([a.romanino@gmail.com](mailto:a.romanino@gmail.com))
- Guido Porruvecchio ([guido.porruvecchio@gmail.com](mailto:guido.porruvecchio@gmail.com))


