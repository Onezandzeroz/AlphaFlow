# Deployment Guide — AlphaAi Accounting

Complete setup instructions for local development and production deployment.

---

## Prerequisites

Install [Bun](https://bun.sh/docs/installation) v1.3+:

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

Verify installation:
```bash
bun --version
```

---

## 1. Local Development (Windows)

```powershell
# Clone the repository
git clone https://github.com/Onezandzeroz/AlphaAi-Bogforingsapp-NEW.git
cd AlphaAi-Bogforingsapp-NEW

# Install dependencies
bun install

# Initialize the database
bun run db:push

# Start the dev server
bun run dev
```

Open **http://localhost:3000** in your browser.

The dev server automatically:
- Checks if port 3000 is available
- Uses Webpack mode (required for Prisma compatibility)
- Hot-reloads on file changes

### Stopping the dev server

Press `Ctrl + C` in the terminal.

### If port 3000 is stuck

```powershell
bun run kill-port
```

---

## 2. Local Production Build (Windows)

```powershell
# Create the production build
bun run build

# Start the production server
bun run start
```

Open **http://localhost:3000** in your browser.

### Running as a background service

For persistent background running on Windows, you can use PM2:

```powershell
# Install PM2 globally
bun add -g pm2

# Start the app
bun run start:pm2

# View status
pm2 status

# View logs
pm2 logs alphaai

# Stop the app
pm2 stop alphaai

# Restart after changes
pm2 restart alphaai
```

---

## 3. Cloud VPS Deployment (Ubuntu)

### 3.1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2 (process manager)
bun add -g pm2
pm2 startup
```

### 3.2. Deploy the Application

```bash
# Clone the repository
git clone https://github.com/Onezandzeroz/AlphaAi-Bogforingsapp-NEW.git
cd AlphaAi-Bogforingsapp-NEW

# Install dependencies
bun install

# Initialize the database
bun run db:push

# Create the production build
bun run build

# Create logs directory (required by PM2)
mkdir -p logs

# Start with PM2
bun run start:pm2

# Save the PM2 configuration so it survives reboots
pm2 save
```

### 3.3. Configure Reverse Proxy (Caddy)

Caddy automatically handles HTTPS certificates.

```bash
# Install Caddy
sudo apt install -y caddy

# Edit the Caddyfile
sudo nano /etc/caddy/Caddyfile
```

Replace the contents with (change `yourdomain.com` to your domain or IP):

```
yourdomain.com {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
```

```bash
# Reload Caddy
sudo caddy reload --config /etc/caddy/Caddyfile
```

Your app is now accessible at **https://yourdomain.com** with automatic HTTPS.

### 3.4. Firewall

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 4. Updating the Deployment

When you pull new changes:

```bash
cd AlphaAi-Bogforingsapp-NEW

# Pull latest code
git pull

# Install any new dependencies
bun install

# Update database schema (if changed)
bun run db:push

# Rebuild for production
bun run build

# Restart the app
pm2 restart alphaai
```

---

## 5. Useful PM2 Commands

| Command | Description |
|---|---|
| `pm2 status` | Show all running apps |
| `pm2 logs alphaai` | Show live logs |
| `pm2 logs alphaai --lines 100` | Show last 100 log lines |
| `pm2 restart alphaai` | Restart the app |
| `pm2 stop alphaai` | Stop the app |
| `pm2 delete alphaai` | Remove from PM2 |
| `pm2 monit` | Real-time monitoring dashboard |

---

## 6. Database Management

The SQLite database is stored at `prisma/db/custom.db`.

### Backup the database

```bash
cp prisma/db/custom.db prisma/db/custom.db.backup
```

### Restore from backup

```bash
cp prisma/db/custom.db.backup prisma/db/custom.db
pm2 restart alphaai
```

### Reset the database (WARNING: deletes all data)

```bash
bun run db:reset
pm2 restart alphaai
```

---

## 7. Troubleshooting

### App won't start — port in use

```bash
# Check what's using port 3000
sudo lsof -i :3000

# Kill it
bun run kill-port
```

### Database errors

```bash
# Re-sync the database schema
bun run db:push

# Regenerate Prisma Client
bun run db:generate
```

### Build errors

```bash
# Clean everything and rebuild
rm -rf .next node_modules
bun install
bun run db:generate
bun run build
```

### PM2 app keeps restarting

```bash
# Check error logs
pm2 logs alphaai --err --lines 50

# Common causes:
# 1. Database file missing → run: bun run db:push
# 2. Port conflict → run: bun run kill-port
# 3. Missing dependencies → run: bun install
```

### Permission errors on Ubuntu

```bash
# Fix file ownership
sudo chown -R $USER:$USER /path/to/AlphaAi-Bogforingsapp-NEW
```
