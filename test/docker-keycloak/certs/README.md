# SSL/TLS Certificates for HTTPS Keycloak Deployment

This folder contains **SSL/TLS certificates** used for HTTPS connections to Keycloak.

## ⚠️ Important Security Notice

- **DO NOT commit these files to version control**
- Certificates are ignored by `.gitignore`
- This folder is only committed with `.gitkeep` to maintain the directory structure

## How to Add Your Certificates

When deploying Keycloak with HTTPS using `setup-keycloak.js`, you need to provide:

1. **keycloak.crt** - Your SSL certificate file
2. **keycloak.key** - Your private key file

### For Local HTTPS Deployment

Place your self-signed or CA-signed certificates in this directory:

```bash
cp /path/to/your/certificate.crt test/docker-keycloak/certs/keycloak.crt
cp /path/to/your/private.key test/docker-keycloak/certs/keycloak.key
```

### For Remote SSH Deployment

The `setup-keycloak.js` script will automatically copy these certificates to the remote server when deploying with HTTPS enabled.

## Generating Self-Signed Certificates (For Testing Only)

If you need to generate self-signed certificates for local testing:

```bash
# Generate a 2048-bit RSA private key
openssl genrsa -out keycloak.key 2048

# Generate a self-signed certificate valid for 365 days
openssl req -new -x509 -key keycloak.key -out keycloak.crt -days 365 \
  -subj "/CN=localhost/O=Test/C=US"
```

### For Remote Servers

Generate certificates for your domain:

```bash
openssl req -new -x509 -key keycloak.key -out keycloak.crt -days 365 \
  -subj "/CN=your-domain.com/O=YourOrg/C=US"
```

## Using with Docker Compose

The `docker-compose-https.yml` file expects certificates at:
- `./certs/keycloak.crt`
- `./certs/keycloak.key`

These are mounted as read-only volumes in the Keycloak container.

## No Docker? Use the SSH Setup Script

Run the interactive setup script to deploy to a remote server:

```bash
npm run setup-keycloak
```

This will:
1. Ask you to choose HTTP or HTTPS
2. Copy your certificates to the remote server
3. Start Keycloak with HTTPS enabled

## Provider Support

- **Let's Encrypt**: Free certificates for production
- **Self-signed**: For development/testing only
- **Internal CA**: For enterprise environments

---

**Never commit real certificates to version control!**
