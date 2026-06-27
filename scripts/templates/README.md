# MDCz WebUI

Self-hosted media catalog with a Fastify backend and a Vite WebUI bundle. Docker
is the recommended deployment path; this archive is the lightweight no-Docker
bundle for users who prefer a local Node.js service.

> Default port: `3838`. Default bind: `127.0.0.1` (loopback only). Set
> `MDCZ_HOST=0.0.0.0` when exposing the service to other machines (the bundled
> Docker image already does this).

## Quick Start With Docker

```bash
docker run -d \
  --name mdcz \
  -p 3838:3838 \
  -v mdcz-data:/data \
  --restart unless-stopped \
  ghcr.io/shotheadman/mdcz:latest
```

Open <http://localhost:3838>. Persistent state lives in the `mdcz-data`
volume (`/data` inside the container).

## No-Docker Portable

Requires Node.js 24 or newer. The install scripts check the local Node version;
when a compatible Node is already installed, they skip any Node setup and only
install runtime dependencies.

```bash
tar -xzf mdcz-<version>.tar.gz
cd mdcz-<version>
./install.sh
./start.sh
```

Windows users run:

```powershell
.\install.ps1
.\start.bat
```

The installer creates `./.env` from `.env.example` if it does not already exist.
Edit `.env` before starting if you need a different port, bind address, data
directory, or admin password.

## systemd (portable + service unit)

```bash
sudo install -d /usr/lib/mdcz /var/lib/mdcz
sudo cp -r ./* /usr/lib/mdcz/
cd /usr/lib/mdcz
sudo ./install.sh

sudo useradd -r -s /usr/sbin/nologin mdcz || true
sudo chown -R mdcz:mdcz /usr/lib/mdcz /var/lib/mdcz

sudo cp systemd/mdcz.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mdcz
journalctl -u mdcz -f
```

Edit `/etc/systemd/system/mdcz.service` if your install path differs from
`/usr/lib/mdcz` (look for the `# REPLACE_ME` comment).

## Environment variables

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port. | `3838` |
| `MDCZ_HOST` | Bind address. | `127.0.0.1` (Docker image: `0.0.0.0`) |
| `MDCZ_HOME` | Base directory for config and data. | platform default |
| `MDCZ_DATA_DIR` | Server data directory. | `$MDCZ_HOME/data` |
| `MDCZ_DATABASE_PATH` | SQLite database path. | `$MDCZ_DATA_DIR/mdcz.sqlite` |
| `MDCZ_WEB_DIST_DIR` | Static WebUI bundle directory. | `web` |
| `MDCZ_ADMIN_PASSWORD` | Override the persisted admin password. | unset |

See `.env.example` for the full list.

## Reverse proxy

Terminate TLS at the proxy and forward one origin to the Node server:

```nginx
location / {
  proxy_pass http://127.0.0.1:3838;
  proxy_set_header Host $host;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;
}

location /events/tasks {
  proxy_pass http://127.0.0.1:3838;
  proxy_buffering off;
  proxy_set_header Connection "";
}
```

## Upgrading

1. Stop the service (`docker stop mdcz` / `systemctl stop mdcz` / `Ctrl-C`).
2. Replace the bundle (or pull the new image).
3. Re-run `./install.sh` or `.\install.ps1` for portable / systemd installs.
4. Start the service again. Migrations run automatically on boot.
