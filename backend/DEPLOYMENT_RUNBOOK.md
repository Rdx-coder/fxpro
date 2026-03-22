# FX Pro Backend Deployment Runbook

## 1. Prerequisites

- Ubuntu 22.04+ (or compatible Linux host)
- Python 3.12+
- MongoDB 6+ (local or managed)
- DNS + TLS certificate (recommended)

## 2. Environment

Create `.env` in backend root:

```env
APP_ENV=production
MONGO_URL=mongodb://<user>:<pass>@<host>:27017
DB_NAME=fxpro_trading
JWT_SECRET_KEY=<strong-random-secret-32-plus-chars>
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_BOOTSTRAP_EMAIL=admin@fxpro.com
ADMIN_BOOTSTRAP_PASSWORD=<strong-admin-password>
CORS_ORIGINS=https://your-frontend-domain.com
SLOW_REQUEST_THRESHOLD_MS=500
AUTH_RATE_LIMIT_LOGIN_PER_MIN=20
AUTH_RATE_LIMIT_REGISTER_PER_MIN=20
AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN=10
LOG_LEVEL=INFO
ENABLE_HSTS=true
ALPHA_VANTAGE_KEY=<optional>
MARKET_LIST_LIVE_FETCH=false
```

## 3. Install + Smoke Test

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install fastapi motor pydantic aiohttp httpx bcrypt python-jose python-dotenv pytest pytest-timeout email-validator python-multipart pymongo uvicorn
python -m pytest -v -rs
python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Validate:

- `GET /api/health` -> `{ "status": "ok" }`
- `GET /api/ready` -> `{ "status": "ok", "db": "up" }`

## 4. Systemd Service

Create `/etc/systemd/system/fxpro-backend.service`:

```ini
[Unit]
Description=FX Pro Backend
After=network.target

[Service]
User=www-data
WorkingDirectory=/opt/fxpro/backend
EnvironmentFile=/opt/fxpro/backend/.env
ExecStart=/opt/fxpro/backend/.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Run:

```bash
sudo systemctl daemon-reload
sudo systemctl enable fxpro-backend
sudo systemctl start fxpro-backend
sudo systemctl status fxpro-backend
```

## 5. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/fxpro-backend`:

```nginx
server {
    listen 80;
    server_name api.your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Request-ID $request_id;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/fxpro-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 6. Final Production Checklist

- App starts with no errors
- `JWT_SECRET_KEY` is strong and unique
- CORS restricted to real frontend domains
- `/api/health` and `/api/ready` are green
- Rate limits configured per auth endpoint
- HTTPS enabled at proxy/load balancer
- Backups enabled for MongoDB
- CI test job passes on every push/PR
