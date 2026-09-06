#!/usr/bin/env bash
set -Eeuo pipefail

[[ $EUID -eq 0 ]] || { echo 'Run as root.' >&2; exit 1; }
release_archive="${1:-/tmp/aura-dashboard-release.tgz}"
[[ -f "$release_archive" ]] || { echo "Release archive not found: $release_archive" >&2; exit 1; }

release_id=$(date +%Y%m%d%H%M%S)
release_dir="/opt/aura-dashboard/releases/$release_id"
install -d -o akdashboard -g akdashboard "$release_dir"
tar -xzf "$release_archive" -C "$release_dir"
cd "$release_dir"
npm ci --omit=dev --ignore-scripts
if [[ -f /root/hxsy/Data/db/T_ItemMall.ini ]]; then
  if [[ -f /root/hxsy/Data/db/T_Item.ini ]]; then
    node ops/build-item-catalog.mjs /root/hxsy/Data/db/T_Item.ini /root/hxsy/Data/db/T_ItemMall.ini data/item-names.json
  else
    node ops/build-item-catalog.mjs /root/hxsy/Data/db/T_ItemMall.ini data/item-names.json
  fi
fi
icon_sources=()
for src in /root/hxsy/Data/db/S_Item.ini /root/hxsy/Data/db/S_ItemMall.ini /root/hxsy/Data/db/S_Enchant.ini /root/hxsy/Data/db/S_Spell.ini /root/hxsy/Data/db/S_Combine.ini; do
  [[ -f "$src" ]] && icon_sources+=("$src")
done
if (( ${#icon_sources[@]} > 0 )); then
  node ops/build-item-icons.mjs "${icon_sources[@]}" data/item-icons.json
fi
account_db=$(node --env-file=/etc/aura-dashboard.env -p 'process.env.ACCOUNT_DB || "FFAccount"')
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/paragon.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/loyalty.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/bonus.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/itemmall.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/redeem-code.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/exp-bonus.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/drop-loot.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/vip-system.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/starter-pack.sql
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$account_db" -f ops/gift.sql
game_db=$(node --env-file=/etc/aura-dashboard.env -p 'process.env.GAME_DB || "FFDB1"')
sudo -u postgres psql -v ON_ERROR_STOP=1 -d "$game_db" -c 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sys_mail_queue, public.player_mail, public.mailitem, public.player_account_mail, public.account_mailitem, public.player_characters, public.inventory1, public.inventory2 TO akdashboard; GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO akdashboard;'
install -o root -g root -m 0750 ops/aura-dashboard-ctl /usr/local/sbin/aura-dashboard-ctl
install -o root -g root -m 0750 ops/deploy-release.sh /usr/local/sbin/aura-dashboard-deploy
install -o root -g root -m 0644 ops/aura-dashboard.service /etc/systemd/system/aura-dashboard.service
chown -R akdashboard:akdashboard "$release_dir"
ln -sfn "$release_dir" /opt/aura-dashboard/current
systemctl daemon-reload
systemctl restart aura-dashboard
systemctl is-active --quiet aura-dashboard
for attempt in {1..20}; do
  curl --fail --silent http://127.0.0.1:4173/ops/api/health >/dev/null && break
  (( attempt == 20 )) && { journalctl -u aura-dashboard -n 30 --no-pager; exit 1; }
  sleep 1
done

find /opt/aura-dashboard/releases -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr | tail -n +6 | cut -d' ' -f2- | xargs -r rm -rf --
echo "Deployed release $release_id"
