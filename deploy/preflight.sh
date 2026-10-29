#!/bin/sh
# Read-only inventory. Never print process environments, credentials or complete nginx configuration.
set -eu
uname -sr
free -m
df -h /
node --version
npm --version
ss -lnt
python3 - <<'PY'
from pathlib import Path
import re
print('Existing nginx domains/ports:')
for path in Path('/etc/nginx/sites-enabled').glob('*'):
    print(path.name)
    for directive in re.findall(r'^\s*(?:listen|server_name|proxy_pass)\s+[^;]+;', path.read_text(), re.M):
        print(directive.strip())
PY
