# Chronicles Desk — server setup

One-time setup for the news API and admin panel on the Ubuntu 24.04 VPS.
Run everything as `ubuntu` over SSH. After this, publishing a dispatch is
just: open `/admin`, write, hit Save.

---

## 1. Node.js 22

Ubuntu 24.04 ships Node 18, which is older than this project needs.

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs build-essential python3
node -v          # expect v22.x
```

`build-essential` and `python3` are there in case `better-sqlite3` has to
compile from source instead of using a prebuilt binary.

## 2. Data directory

The database and uploaded images live **outside** the web root, so a
deploy that mirrors the repo into `/var/www` can never delete them.

```bash
sudo mkdir -p /var/lib/aurakingdom/uploads
sudo chown -R www-data:www-data /var/lib/aurakingdom
sudo chmod 750 /var/lib/aurakingdom
```

## 3. Install dependencies

```bash
cd /var/www/aurakingdom.online/server
npm ci --omit=dev        # or: npm install --omit=dev
```

## 4. Set the admin password

Type it here on the server. Only the bcrypt hash is stored — nothing
plaintext ever reaches the disk, the repo, or the logs.

```bash
cd /var/www/aurakingdom.online/server
sudo -u www-data AK_DATA_DIR=/var/lib/aurakingdom npm run set-password
```

Use something long and unique. This password is the only thing standing
between the public internet and your site's content.

## 5. Run it as a service

```bash
sudo cp /var/www/aurakingdom.online/deploy/aurakingdom-api.service \
        /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now aurakingdom-api
sudo systemctl status aurakingdom-api      # expect "active (running)"
```

Logs, when something misbehaves:

```bash
sudo journalctl -u aurakingdom-api -f
```

## 6. Wire up nginx

The live config is managed by Certbot, so **do not overwrite it**. Install
the location blocks as a snippet and include them instead:

```bash
sudo mkdir -p /etc/nginx/snippets
sudo cp /var/www/aurakingdom.online/deploy/aurakingdom-locations.conf \
        /etc/nginx/snippets/
sudo nano /etc/nginx/sites-available/aurakingdom.online
```

Inside the `server { ... }` block that listens on 443, delete the existing
`root`, `index` and `location /` lines and put this in their place:

```nginx
include snippets/aurakingdom-locations.conf;
```

Then check and reload:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` must say `syntax is ok` before you reload. If it complains,
the old lines are probably still there alongside the include.

## 7. Try it

Open `https://aurakingdom.online/admin`, sign in, and publish a dispatch.
It appears on the home page immediately — no deploy, no rebuild.

---

## How the pieces fit

| Path | Served by | What it is |
|---|---|---|
| `/` | nginx (static) | The landing page |
| `/news/<slug>` | nginx → `article.html` | One dispatch, fetched from the API |
| `/api/*` | Node on `127.0.0.1:3001` | Reads and writes dispatches |
| `/admin` | Node on `127.0.0.1:3001` | The editor |
| `/pre-register.html` | nginx (static) | The pre-registration page |
| `/uploads/*` | nginx (alias) | Images you upload in the editor |

The Node service listens on localhost only — nginx is the sole way in,
so the API is never exposed directly to the internet.

## Pre-registrations

Sign-ups from `/pre-register.html` land in the same database as the
dispatches. There is no screen for them yet — read them over the API
while signed in to `/admin` in the same browser:

| URL | What you get |
|---|---|
| `/api/admin/pre-registrations` | Every entry as JSON, newest first |
| `/api/admin/pre-registrations.csv` | The same list as a spreadsheet |

`/api/pre-register` is the only public part: it answers with the running
total, which is what the page's counter shows. One visitor may add at
most 5 entries per hour; rejected attempts do not count against that.

A reserved character name is held for whoever claimed it first — names
are compared case-insensitively, and the database enforces it.

## Backup

Everything worth keeping is in one directory:

```bash
sudo tar czf ~/aurakingdom-backup-$(date +%F).tar.gz -C /var/lib aurakingdom
```

## Updating after a deploy

Static files need nothing. If `server/` changed:

```bash
cd /var/www/aurakingdom.online/server
npm ci --omit=dev
sudo systemctl restart aurakingdom-api
```

## Optional: let GitHub Actions restart the service

`.github/workflows/deploy.yml` restarts the API after each deploy, so new
server code actually takes effect. That one command needs passwordless
sudo — and only that one command:

```bash
echo 'ubuntu ALL=(ALL) NOPASSWD: /usr/bin/systemctl restart aurakingdom-api' \
  | sudo tee /etc/sudoers.d/aurakingdom-api
sudo chmod 440 /etc/sudoers.d/aurakingdom-api
sudo visudo -c          # must report "parsed OK"
```

This grants exactly one command, not general root access. If you would
rather not grant even that, delete the "Refresh the news service" step
from the workflow and restart by hand after changes to `server/`.
