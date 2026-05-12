# Odoo 18 POS SaaS — Setup Guide

A multi-tenant Point of Sale SaaS platform built on Odoo 18 Community,
deployed with Docker on a single Ubuntu 24.04 VPS.

---

## What this system does

- One server hosts multiple isolated shops
- Each shop gets its own URL: `shop1.yourdomain.com`, `shop2.yourdomain.com`
- Each shop has its own database — shops cannot see each other
- Shop owners and cashiers access the system via browser or mobile Safari
- Standard Odoo POS interface — no custom modifications

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
│   └── odoo.conf             # Odoo configuration
└── backups/                  # Auto-created by backup_all.sh
```

---

## PHASE 1 — Testing (no domain, GCP VM, raw IP)

Use this phase to learn the system and confirm everything works
before spending money on a domain.

### Step 1 — Prepare the server

SSH into your GCP VM and run:

```bash
sudo apt-get update && sudo apt-get install -y git curl docker-compose-plugin
```

Add swap memory (prevents crashes on small VMs):

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Open GCP firewall ports (run in GCP Cloud Shell or locally):

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

Create your `.env` file — this is NOT in the repo, you create it manually:

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

> Change all passwords before using in production.

### Step 3 — Start the stack

```bash
sudo docker compose up -d
sudo docker ps -a
```

Wait until all 3 containers show `healthy`. Takes about 60 seconds.
If `odoo-app` shows `health: starting`, wait 30 more seconds and check again.

### Step 4 — Create a test database

Open in your browser:

```
http://YOUR_GCP_IP:8069/web/database/manager
```

Fill in:

| Field | Value |
|---|---|
| Master Password | `OdooMaster_2025!` |
| Database Name | `testshop` |
| Email | `admin@testshop.com` |
| Password | `Admin_2025!` |
| Language | English (US) |
| Demo Data | unchecked |

Click **Create database**. Wait 2-3 minutes. It redirects to the login page.

### Step 5 — Install Point of Sale

After logging in go to **Apps**, find **Point of Sale**, click **Activate**.
Wait ~1 minute for it to install.

### Step 6 — Test the POS

1. Go to **Point of Sale → Dashboard**
2. Click **Open** on your POS session
3. Add a test product and complete a test sale
4. Confirm receipts and payment methods work

### Step 7 — Test on iPhone (optional, requires HTTPS tunnel)

iOS Safari needs HTTPS to work properly. For testing use a free tunnel:

```bash
# Install on the GCP VM
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb \
  -o cloudflared.deb
sudo dpkg -i cloudflared.deb

# Start tunnel — keep this terminal open
cloudflared tunnel --url http://localhost:8069
```

It prints a URL like `https://abc-def.trycloudflare.com`.
Open that on your iPhone in Safari to test.

---

## PHASE 2 — Production (real domain, HTTPS, multi-tenant)

### Step 1 — Get a domain

Buy from Namecheap, Cloudflare, or any registrar (~$10/year).
Use Cloudflare as your DNS provider (free) — it gives you the best
integration with NPM for wildcard SSL.

### Step 2 — Point DNS to your server

In Cloudflare DNS add a wildcard A record:

| Type | Name | Value |
|---|---|---|
| A | `*` | `YOUR_GCP_EXTERNAL_IP` |
| A | `@` | `YOUR_GCP_EXTERNAL_IP` |

This makes `anyshop.yourdomain.com` automatically point to your server.

### Step 3 — Close testing ports in GCP firewall

```bash
# Remove the open test rule
gcloud compute firewall-rules delete allow-odoo-test

# Create production rule — only 80 and 443
gcloud compute firewall-rules create allow-odoo-prod \
  --allow tcp:80,tcp:443 \
  --source-ranges 0.0.0.0/0
```

Port 8069 and 81 should NOT be open to the internet in production.

### Step 4 — Configure Nginx Proxy Manager

Access NPM via SSH tunnel (never expose port 81 publicly):

```bash
# Run this on your LOCAL machine, not the server
ssh -L 8081:localhost:81 YOUR_USERNAME@YOUR_GCP_IP
```

Then open `http://localhost:8081` in your browser.

Default login: `admin@example.com` / `changeme`
**Change this password immediately.**

Add a wildcard SSL certificate:
1. SSL Certificates → Add SSL Certificate → Let's Encrypt
2. Domain Names: `*.yourdomain.com` and `yourdomain.com`
3. Enable DNS Challenge
4. Select Cloudflare, enter your Cloudflare API token
5. Save — certificate issues in about 30 seconds

### Step 5 — Enable production security

```bash
sudo nano /opt/odoo-saas/odoo/odoo.conf
```

Remove the `;` from both of these lines:

```ini
db_filter = ^%d$
list_db   = False
```

Restart Odoo:

```bash
sudo docker compose restart odoo
```

### Step 6 — Provision your first real shop

```bash
cd /opt/odoo-saas
./provision_shop.sh --shop acme --domain yourdomain.com
```

This automatically:
- Creates a database named `acme`
- Installs Point of Sale
- Creates proxy host `acme.yourdomain.com → Odoo`
- Issues SSL certificate
- Prints the admin credentials

Visit `https://acme.yourdomain.com` — loads with HTTPS and padlock. ✓

### Step 7 — Set up automatic backups

```bash
# Test backup manually first
chmod +x backup_all.sh
./backup_all.sh

# Enable daily backup at 02:00
sudo systemctl enable odoo-backup.timer
sudo systemctl start odoo-backup.timer
```

Backups saved to `/opt/odoo-saas/backups/`, kept for 14 days.

### Step 8 — Add more shops

```bash
./provision_shop.sh --shop shopname --domain yourdomain.com
```

One command per shop. Each gets its own URL and isolated database.

---

## Managing shops day-to-day

### Add a cashier user
1. Log in as admin at `https://shopname.yourdomain.com/web`
2. Settings → Users → New User
3. Set role to **Point of Sale / User**
4. Save and share login link with the cashier

### Add products with barcodes
1. Go to **Point of Sale → Products → New**
2. Fill in name, price, and barcode field
3. On iPhone: tap the barcode field → tap the camera icon on the keyboard
4. Point at a barcode — it fills in automatically

### Manually backup one shop
```bash
sudo docker compose exec postgres \
  pg_dump -U odoo --format=custom shopname > shopname_backup.pgdump
```

### Restore a shop
```bash
sudo docker compose exec -T postgres \
  pg_restore -U odoo -d shopname < shopname_backup.pgdump
```

---

## Common commands

```bash
# Check all containers
sudo docker compose ps

# Watch Odoo logs live
sudo docker logs -f odoo-app

# Restart Odoo only (after odoo.conf change)
sudo docker compose restart odoo

# Restart everything
sudo docker compose down && sudo docker compose up -d

# Nuclear reset — DELETES ALL DATA
sudo docker compose down -v && sudo docker compose up -d
```

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Yellow border / "connection lost" | WebSocket needs NPM proxy | Normal in testing, gone in production |
| "Database manager disabled" | `list_db = False` in odoo.conf | Comment it out for testing |
| Port 8069 unreachable | GCP firewall rule missing | Add firewall rule |
| Password auth failed on postgres | Stale volume from old credentials | `docker compose down -v` then up |
| Odoo very slow or crashing | Not enough RAM | Check swap: `free -h` |
| Shop shows wrong database | `db_filter` misconfigured | Check DNS and db_filter in odoo.conf |

---

## Security checklist before go-live

- [ ] Change `POSTGRES_PASSWORD` in `.env` from the default
- [ ] Change `db_password` in `odoo.conf` to match
- [ ] Change `ODOO_MASTER_PW` in `.env` from the default
- [ ] Change `admin_passwd` in `odoo.conf` to match
- [ ] Change NPM admin password from `changeme`
- [ ] Close GCP firewall port 8069 (testing only)
- [ ] Close GCP firewall port 81 (use SSH tunnel instead)
- [ ] Enable `db_filter = ^%d$` in `odoo.conf`
- [ ] Enable `list_db = False` in `odoo.conf`
- [ ] Confirm `.env` is NOT on GitHub: `git ls-files | grep .env`
- [ ] Confirm swap is active: `free -h`
- [ ] Test backup runs cleanly: `./backup_all.sh`

---

## Passwords reference

All passwords live only in `.env` on the server — never in GitHub.

| What | Location | Default (change it) |
|---|---|---|
| PostgreSQL password | `.env` → `POSTGRES_PASSWORD` and `odoo.conf` → `db_password` | `OdooSaaS_Pg_2025!` |
| Odoo master password | `.env` → `ODOO_MASTER_PW` and `odoo.conf` → `admin_passwd` | `OdooMaster_2025!` |
| NPM admin password | NPM UI after first login | `changeme` |
| Shop admin password | Set when creating each database | Set by you |

> **Rule:** if you change a password in `.env`, update the matching line
> in `odoo.conf` too, then restart: `sudo docker compose restart odoo`
