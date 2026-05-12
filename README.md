# Odoo 18 POS SaaS — Setup Guide

A multi-tenant Point of Sale SaaS platform built on Odoo 18 Community,
deployed with Docker on a single Ubuntu 24.04 VPS, with a PWA frontend
for iPhone (iOS standalone mode + QR/Barcode scanner).

---

## What this system does

- One server hosts multiple isolated shops
- Each shop gets its own URL: `shop1.yourdomain.com`, `shop2.yourdomain.com`
- Each shop has its own database — shops cannot see each other
- Shop owners and cashiers use an iPhone PWA (looks like a native app)
- Barcode/QR scanning uses the iPhone camera — no hardware scanner needed

---

## File structure

```
/
├── docker-compose.yml        # Defines the 3 containers
├── .env                      # YOUR PASSWORDS — never push to GitHub
├── .gitignore                # Keeps .env out of GitHub
├── provision_shop.sh         # Creates a new shop (run once per shop)
├── backup_all.sh             # Backs up all shop databases
├── odoo/
│   ├── odoo.conf             # Odoo configuration
│   └── addons/
│       └── pwa_pos_ios/      # Custom PWA + scanner module
└── backups/                  # Auto-created by backup_all.sh
```

---

## PHASE 1 — Testing (no domain, GCP VM, raw IP)

Use this phase to learn the system and test POS before going live.

### Step 1 — Prepare the server

SSH into your GCP VM and run:

```bash
sudo apt-get update && sudo apt-get install -y git curl docker-compose-plugin
```

Open GCP firewall ports (run on your local machine or GCP Cloud Shell):

```bash
gcloud compute firewall-rules create allow-odoo-test \
  --allow tcp:80,tcp:443,tcp:8069,tcp:81 \
  --source-ranges 0.0.0.0/0
```

### Step 2 — Clone and configure

```bash
cd /opt
sudo git clone https://github.com/mahmouuud230/POS_System.git odoo-saas
sudo chown -R $USER:$USER /opt/odoo-saas
cd /opt/odoo-saas
```

Create your `.env` file (this is NOT in the repo — you create it manually):

```bash
cat > .env << 'EOF'
POSTGRES_USER=odoo
POSTGRES_PASSWORD=OdooSaaS_Pg_2025!
HOST=postgres
PORT=5432
USER=odoo
PASSWORD=OdooSaaS_Pg_2025!
ODOO_MASTER_PW=OdooMaster_2025!
NPM_USER=admin@example.com
NPM_PASS=NpmAdmin_2025!
EOF
```

> Change the passwords above to your own before using in production.

### Step 3 — Start the stack

```bash
sudo docker compose up -d
sudo docker ps -a
```

Wait until all 3 containers show `healthy`. Takes about 60 seconds.
If odoo-app shows `health: starting`, wait 30 more seconds and check again.

### Step 4 — Create a test database

Open in your browser:
```
http://YOUR_GCP_IP:8069/web/database/manager
```

Fill in:
- Master Password: `OdooMaster_2025!`
- Database Name: `testshop`
- Email: `admin@testshop.com`
- Password: `Admin_2025!`
- Language: English (US)
- Demo Data: unchecked

Click **Create database**. Wait 2-3 minutes. It will redirect to the login page.

### Step 5 — Install Point of Sale

After logging in, go to the Apps page and click **Activate** on **Point of Sale**.
Wait 1 minute for it to install.

### Step 6 — Test PWA on iPhone (requires HTTPS)

iOS Safari requires HTTPS for PWA. Get a free HTTPS tunnel:

```bash
# Install cloudflared on the GCP VM
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Start the tunnel (keep this terminal open)
cloudflared tunnel --url http://localhost:8069
```

It prints a URL like `https://abc-def.trycloudflare.com`.

On your iPhone:
1. Open **Safari** (must be Safari, not Chrome)
2. Go to the tunnel URL
3. Log in to Odoo
4. Tap **Share → Add to Home Screen → Add**
5. Open the app from your home screen
6. It opens fullscreen with no address bar = real PWA ✓

### Step 7 — Test the POS

1. In Odoo go to **Point of Sale → Dashboard**
2. Click **Open** on your POS session
3. Add a test product and make a test sale
4. Try the barcode scanner button (requires camera permission on iPhone)

---

## PHASE 2 — Production (real domain, HTTPS, multi-tenant)

Use this phase when you are ready to onboard real shops.

### Step 1 — Get a domain

Buy a domain from Namecheap, Cloudflare, or any registrar (~$10/year).
Example: `yourdomain.com`

Add it to Cloudflare DNS (free) for best results.

### Step 2 — Point DNS to your GCP VM

In your DNS provider, add a wildcard A record:

```
Type:  A
Name:  *
Value: YOUR_GCP_EXTERNAL_IP
TTL:   Auto
```

This makes `anyshop.yourdomain.com` point to your server automatically.

### Step 3 — Configure Nginx Proxy Manager

Open NPM admin (use SSH tunnel for security):

```bash
# On your laptop
ssh -L 8081:localhost:81 YOUR_USERNAME@YOUR_GCP_IP
```

Then open `http://localhost:8081` in your browser.

Default login: `admin@example.com` / `changeme`
**Change the password immediately after first login.**

Add a wildcard SSL certificate:
1. Click **SSL Certificates → Add SSL Certificate → Let's Encrypt**
2. Domain: `*.yourdomain.com`
3. Enable **DNS Challenge**
4. Enter your DNS provider API credentials
5. Click **Save** — certificate issues in ~30 seconds

### Step 4 — Enable production security in odoo.conf

```bash
sudo nano /opt/odoo-saas/odoo/odoo.conf
```

Remove the `;` from these two lines:

```ini
db_filter = ^%d$
list_db   = False
```

Restart Odoo:

```bash
sudo docker compose restart odoo
```

### Step 5 — Provision your first real shop

```bash
cd /opt/odoo-saas
./provision_shop.sh --shop acme --domain yourdomain.com
```

This automatically:
- Creates database `acme`
- Installs Point of Sale
- Creates proxy host `acme.yourdomain.com → Odoo`
- Issues SSL certificate
- Prints the shop login credentials

Visit `https://acme.yourdomain.com` — it loads with HTTPS. ✓

### Step 6 — Install PWA on shop owner's iPhone

Send the shop owner this instruction:
1. Open `https://acme.yourdomain.com` in Safari
2. Tap Share → Add to Home Screen → Add
3. Open the POS icon from the home screen
4. Done — it runs fullscreen like a native app

### Step 7 — Set up automatic backups

```bash
# Test backup manually first
./backup_all.sh

# Then enable the daily timer
sudo systemctl enable odoo-backup.timer
sudo systemctl start odoo-backup.timer
```

Backups are saved to `/opt/odoo-saas/backups/` and kept for 14 days.

### Step 8 — Add more shops

Each new shop is one command:

```bash
./provision_shop.sh --shop newshop --domain yourdomain.com
```

---

## Managing shops

### Create a new shop
```bash
./provision_shop.sh --shop shopname --domain yourdomain.com
```

### Access a shop's admin panel
```
https://shopname.yourdomain.com/web
```

### Add a cashier user to a shop
1. Log in to the shop as admin
2. Go to Settings → Users → New User
3. Set role to **Point of Sale / User**
4. Save and send them the login link

### Manually backup one shop
```bash
docker compose exec postgres pg_dump -U odoo --format=custom shopname > shopname_backup.pgdump
```

### Restore a shop
```bash
docker compose exec -T postgres pg_restore -U odoo -d shopname < shopname_backup.pgdump
```

---

## Common commands

```bash
# Check container status
sudo docker compose ps

# View Odoo logs live
sudo docker logs -f odoo-app

# Restart Odoo only (after config change)
sudo docker compose restart odoo

# Restart everything
sudo docker compose down && sudo docker compose up -d

# Wipe everything and start fresh (DELETES ALL DATA)
sudo docker compose down -v && sudo docker compose up -d
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Yellow border / "connection lost" | WebSocket needs NPM proxy | Normal in testing — disappears in production |
| "Database manager disabled" | `list_db = False` in odoo.conf | Comment it out for testing |
| Can't reach port 8069 | GCP firewall or missing `ports:` in compose | Add firewall rule; check compose file |
| PWA installs as bookmark not app | No HTTPS | Use Cloudflare tunnel or real domain with SSL |
| Camera not working in PWA | HTTP or permission denied | Must be HTTPS; check iPhone Settings → Safari → Camera |
| Password auth failed on postgres | Stale volume with old credentials | Run `docker compose down -v` then up again |

---

## Security checklist before going live

- [ ] Change all passwords in `.env` from the defaults
- [ ] Change `db_password` in `odoo.conf` to match new `POSTGRES_PASSWORD`
- [ ] Change `admin_passwd` in `odoo.conf` to match new `ODOO_MASTER_PW`
- [ ] Change NPM admin password from `changeme`
- [ ] Close GCP firewall port 8069 (only needed during testing)
- [ ] Close GCP firewall port 81 (NPM admin — use SSH tunnel instead)
- [ ] Enable `db_filter = ^%d$` in odoo.conf
- [ ] Enable `list_db = False` in odoo.conf
- [ ] Confirm `.env` is in `.gitignore` and not on GitHub

---

## Passwords quick reference

All passwords live in `.env` on the server at `/opt/odoo-saas/.env`.
This file is never pushed to GitHub.

| What | Where set | Default (change this!) |
|---|---|---|
| PostgreSQL DB password | `.env` → `POSTGRES_PASSWORD` | `OdooSaaS_Pg_2025!` |
| Odoo master password | `.env` → `ODOO_MASTER_PW` | `OdooMaster_2025!` |
| NPM admin password | NPM UI after first login | `changeme` |
| Shop admin password | Set during DB creation | Set by you |
