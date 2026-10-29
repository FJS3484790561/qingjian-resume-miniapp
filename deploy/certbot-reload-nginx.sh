#!/bin/sh
# Certbot deploy hook: validate every config before a graceful certificate reload.
set -eu
/usr/sbin/nginx -t
/bin/systemctl reload nginx
