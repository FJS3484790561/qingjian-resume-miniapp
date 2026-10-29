#!/bin/bash
# Initial isolated installation. Existing Nginx and other applications are untouched.
# Supply a credential-free archive and a new explicit release name; run as root.
set -euo pipefail
umask 077
archive=${1:?Provide an absolute server archive path}
release=${2:?Provide a new release identifier}
[[ $EUID -eq 0 && $archive == /* && -f $archive ]]
[[ $release =~ ^[0-9]{8}-[0-9]{6}$ ]]
target=/opt/qingyu/releases/$release
[[ ! -e $target ]]
[[ ! -e /opt/qingyu/current ]] || { echo 'Existing installation: back up and follow the documented upgrade procedure'; exit 1; }
[[ -s /etc/qingyu/api.env ]] || { echo 'Configure /etc/qingyu/api.env first'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<22)process.exit(1)'
if ! id qingyu >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/qingyu --shell /usr/sbin/nologin qingyu
fi
install -d -m 0755 /opt/qingyu /opt/qingyu/releases
install -d -o qingyu -g qingyu -m 0700 /var/lib/qingyu /var/cache/qingyu-npm
install -d -o qingyu -g qingyu -m 0755 "$target" /opt/qingyu/browsers
tar -xzf "$archive" --no-same-owner -C "$target"
chown -R qingyu:qingyu "$target"
cd "$target"
# Use the project's pinned lockfile and the official registry; never run package install scripts.
runuser -u qingyu -- env NODE_OPTIONS=--max-old-space-size=384 PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
  npm ci --omit=dev --ignore-scripts --no-audit --no-fund --maxsockets=2 \
  --cache /var/cache/qingyu-npm --registry=https://registry.npmjs.org
# Install only Chromium's supported host dependencies and a Chinese font family.
./node_modules/.bin/playwright install-deps chromium
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends fonts-noto-cjk
runuser -u qingyu -- env PLAYWRIGHT_BROWSERS_PATH=/opt/qingyu/browsers \
  ./node_modules/.bin/playwright install chromium --only-shell
chown -R root:root "$target"
chmod -R u=rwX,go=rX "$target"
chown -R root:root /opt/qingyu/browsers
chmod -R u=rwX,go=rX /opt/qingyu/browsers
ln -sfn "$target" /opt/qingyu/current
install -m 0644 deploy/qingyu-api.service /etc/systemd/system/qingyu-api.service
systemctl daemon-reload
systemctl enable --now qingyu-api.service
for attempt in $(seq 1 30); do
  if curl --fail --silent http://127.0.0.1:8790/health; then
    echo
    echo 'Qingyu isolated service is ready on loopback port 8790'
    exit 0
  fi
  sleep 1
done
echo 'Service did not become ready. Inspect sanitized service diagnostics.'
exit 1
