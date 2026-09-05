#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }

APP_USER=akdashboard
APP_ROOT=/opt/aura-dashboard

node_major=0
command -v node >/dev/null && node_major=$(node --version | sed -E 's/^v([0-9]+).*/\1/')
if (( node_major < 22 )); then
  apt-get update
  apt-get install -y ca-certificates curl gnupg
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg
  echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" \
    >/etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi

id "$APP_USER" >/dev/null 2>&1 || useradd --system --home-dir "$APP_ROOT" --shell /usr/sbin/nologin "$APP_USER"
install -d -o "$APP_USER" -g "$APP_USER" "$APP_ROOT/releases" /var/log/aura-dashboard
install -o root -g root -m 0750 ops/aura-dashboard-ctl /usr/local/sbin/aura-dashboard-ctl
install -o root -g root -m 0750 ops/deploy-release.sh /usr/local/sbin/aura-dashboard-deploy
printf '%s ALL=(root) NOPASSWD: /usr/local/sbin/aura-dashboard-ctl\n' "$APP_USER" >/etc/sudoers.d/aura-dashboard
chmod 0440 /etc/sudoers.d/aura-dashboard
visudo -cf /etc/sudoers.d/aura-dashboard

for database in FFAccount FFDB1 FFMember; do
  sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$database" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$APP_USER') THEN
    CREATE ROLE $APP_USER LOGIN;
  END IF;
END
\$\$;
GRANT CONNECT ON DATABASE "$database" TO $APP_USER;
GRANT USAGE ON SCHEMA public TO $APP_USER;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO $APP_USER;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO $APP_USER;
SQL
done

if [[ ! -f /etc/aura-dashboard.env ]]; then
  read -r -s -p 'Dashboard admin password (minimum 12 characters): ' admin_password
  printf '\n'
  (( ${#admin_password} >= 12 )) || { echo 'Password is too short.' >&2; exit 1; }
  password_hash=$(node -e "const{randomBytes,scryptSync}=require('crypto');const p=process.argv[1],s=randomBytes(16).toString('hex');console.log('\$scrypt\$16384\$8\$1\$'+s+'\$'+scryptSync(p,s,64,{N:16384,r:8,p:1}).toString('hex'))" "$admin_password")
  session_secret=$(openssl rand -hex 32)
  install -m 0600 /dev/null /etc/aura-dashboard.env
  {
    echo 'NODE_ENV=production'
    echo 'PORT=4173'
    echo 'DASHBOARD_ADMIN_USER=admin'
    printf 'DASHBOARD_PASSWORD_HASH=%s\n' "$password_hash"
    printf 'SESSION_SECRET=%s\n' "$session_secret"
    echo 'CONTROL_COMMAND=/usr/local/sbin/aura-dashboard-ctl'
    echo 'PGHOST=/var/run/postgresql'
    echo 'PGUSER=akdashboard'
    echo 'GAME_DB=FFDB1'
    echo 'ACCOUNT_DB=FFAccount'
    echo 'MEMBER_DB=FFMember'
  } >/etc/aura-dashboard.env
fi

install -o root -g root -m 0644 ops/aura-dashboard.service /etc/systemd/system/aura-dashboard.service
install -o root -g root -m 0644 ops/nginx-location.conf /etc/nginx/snippets/aura-dashboard.conf
systemctl daemon-reload
systemctl enable aura-dashboard

echo 'Server prerequisites installed.'
echo 'Include /etc/nginx/snippets/aura-dashboard.conf inside the existing HTTPS server block, then reload nginx.'
