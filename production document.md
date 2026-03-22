# Production Document

Complete deployment and app build guide for this project.

This document covers:
- Local setup and run commands
- Backend deployment on Render
- Frontend web deployment on Vercel
- Android APK generation with EAS
- All environment variables and where to paste them
- Verification, troubleshooting, and release checklist

---

## 1. Project Structure

From repository root:
- Backend: `backend`
- Frontend: `frontend`

---

## 2. Prerequisites

Install locally:
- Python 3.11+ (or 3.10+)
- Node.js 18+ and npm
- Git
- Expo account (for EAS)
- Render account
- Vercel account
- MongoDB (Atlas recommended for production)

Check versions:

```bash
python --version
node -v
npm -v
```

Install EAS CLI:

```bash
npm install -g eas-cli
```

---

## 3. Local Development Commands

### 3.1 Backend (Local)

Windows CMD:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Linux/macOS:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Health checks:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/ready
```

### 3.2 Frontend (Local)

```bash
cd frontend
npm install
npx expo start
```

Web preview:

```bash
npx expo start --web
```

Android local preview:

```bash
npx expo start --android
```

---

## 4. Backend Production Deployment (Render)

## 4.1 Create Render Service

Render dashboard:
1. New + -> Web Service
2. Connect GitHub repo
3. Select this repository

Settings:
- Name: `fxpro-backend` (or your choice)
- Root Directory: `backend`
- Runtime: Python
- Region: choose nearest users

Build Command:

```bash
pip install -r requirements.txt
```

Start Command:

```bash
uvicorn server:app --host 0.0.0.0 --port $PORT
```

Health Check Path:
- `/api/health`

## 4.2 Render Environment Variables (Where to Paste)

Render -> Service -> Environment -> Add Environment Variable.

Paste these keys (production values):

```env
APP_ENV=production
MONGO_URL=<your_mongodb_connection_string>
DB_NAME=fxpro_trading
JWT_SECRET_KEY=<strong_random_secret_min_32_chars>
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_BOOTSTRAP_EMAIL=admin@fxpro.com
ADMIN_BOOTSTRAP_PASSWORD=<strong_admin_password>
CORS_ORIGINS=https://your-vercel-domain.vercel.app,https://your-custom-domain.com
LOG_LEVEL=INFO
ENABLE_HSTS=true
SLOW_REQUEST_THRESHOLD_MS=500
AUTH_RATE_LIMIT_LOGIN_PER_MIN=20
AUTH_RATE_LIMIT_REGISTER_PER_MIN=20
AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN=10
ALPHA_VANTAGE_KEY=<optional>
MARKET_LIST_LIVE_FETCH=false
ECONOMIC_CALENDAR_PROVIDER=tradingeconomics
ECONOMIC_CALENDAR_TIMEOUT_SEC=12
TRADING_ECONOMICS_API_KEY=<optional>
TRADING_ECONOMICS_API_SECRET=<optional>
```

Notes:
- `TRADING_ECONOMICS_API_*` optional (guest mode works with limitations).
- `CORS_ORIGINS` must contain web domains (comma-separated).

## 4.3 Verify Render Deployment

After deploy, test:

```bash
curl https://YOUR_RENDER_BACKEND_URL/api/health
curl https://YOUR_RENDER_BACKEND_URL/api/ready
```

Expected response includes `status: ok`.

---

## 5. Frontend Web Deployment (Vercel)

## 5.1 Create Vercel Project

Vercel dashboard:
1. Add New -> Project
2. Import GitHub repository
3. Set Root Directory: `frontend`

Build settings:
- Build Command:

```bash
npx expo export --platform web
```

- Output Directory:

```text
dist
```

## 5.2 Vercel Environment Variable (Where to Paste)

Vercel -> Project -> Settings -> Environment Variables.

Add:

```env
EXPO_PUBLIC_BACKEND_URL=https://YOUR_RENDER_BACKEND_URL
```

Then trigger redeploy.

Important:
- This must be Render backend URL.
- Do not use Vercel URL as backend API base.

---

## 6. Android APK Generation (EAS)

This project already contains:
- `frontend/app.json`
- `frontend/eas.json`

## 6.1 Check App IDs

In `frontend/app.json` verify:
- `expo.android.package`
- `expo.ios.bundleIdentifier`

Current pattern:
- `com.fxpro.mobile`

If publishing publicly and package is taken, change to unique package.

## 6.2 Check EAS Profiles

In `frontend/eas.json` verify:
- `cli.appVersionSource` is set
- build profile `preview` uses APK
- `EXPO_PUBLIC_BACKEND_URL` points to Render backend URL

## 6.3 Build APK Command

```bash
cd frontend
eas login
eas build -p android --profile preview
```

Output:
- EAS build URL + QR code
- Download APK from the URL

Install on Android:
- Open link on phone browser
- Download APK
- Allow install from unknown source if prompted
- Install app

## 6.4 Build AAB (Play Store)

```bash
cd frontend
eas build -p android --profile production
```

This creates `.aab` for Play Console upload.

---

## 7. Release Update Process (Every Deployment)

When backend code changes:
1. Push code
2. Render auto-deploys
3. Verify `/api/health` and one authenticated endpoint

When frontend web changes:
1. Push code
2. Vercel auto-deploys
3. Verify login + API calls on web

When mobile app behavior/env changes:
1. Ensure `eas.json` backend URL is correct
2. Build new APK
3. Install new APK (or ship AAB for Play Store)

Note:
- APK embeds `EXPO_PUBLIC_BACKEND_URL` at build time.
- If backend URL changes, rebuild APK.

---

## 8. Production Environment Files (Reference)

## 8.1 backend/.env (Local Reference)

Use local file for local run only. Do not commit secrets.

Template:

```env
APP_ENV=development
MONGO_URL=mongodb://localhost:27017
DB_NAME=fxpro_trading
JWT_SECRET_KEY=dev_secret_change_me
ACCESS_TOKEN_EXPIRE_MINUTES=60
ADMIN_BOOTSTRAP_EMAIL=admin@fxpro.com
ADMIN_BOOTSTRAP_PASSWORD=admin@123
CORS_ORIGINS=http://localhost:8081,http://localhost:3000,http://localhost:5173
LOG_LEVEL=INFO
ENABLE_HSTS=false
SLOW_REQUEST_THRESHOLD_MS=500
AUTH_RATE_LIMIT_LOGIN_PER_MIN=20
AUTH_RATE_LIMIT_REGISTER_PER_MIN=20
AUTH_RATE_LIMIT_FORGOT_PASSWORD_PER_MIN=10
ALPHA_VANTAGE_KEY=
MARKET_LIST_LIVE_FETCH=false
ECONOMIC_CALENDAR_PROVIDER=tradingeconomics
ECONOMIC_CALENDAR_TIMEOUT_SEC=12
TRADING_ECONOMICS_API_KEY=
TRADING_ECONOMICS_API_SECRET=
```

## 8.2 frontend/.env (Local Reference)

Template:

```env
EXPO_PUBLIC_BACKEND_URL=http://localhost:8000
EXPO_TUNNEL_SUBDOMAIN=
EXPO_PACKAGER_HOSTNAME=
EXPO_USE_FAST_RESOLVER=1
METRO_CACHE_ROOT=.metro-cache
```

Important correction:
- If `EXPO_PUBLIC_BACKEND_URL` is set to your Vercel URL, API calls will fail.
- It must be backend URL (Render in production, localhost in local dev).

---

## 9. Validation Checklist (Before Shipping)

Backend:
- [ ] `/api/health` returns OK
- [ ] `/api/ready` returns DB up
- [ ] Auth register/login works
- [ ] CORS_ORIGINS includes Vercel/custom domains

Web:
- [ ] Login works from Vercel URL
- [ ] API calls hit Render backend

Android APK:
- [ ] Install successful
- [ ] Login/register works
- [ ] Profile loads data
- [ ] Trades/funds/calender pages call backend successfully

Security:
- [ ] Production JWT secret is strong
- [ ] No local localhost values in production envs
- [ ] No secrets committed to git

---

## 10. Common Errors and Fixes

### Error: EAS prebuild failed (missing splash/icon)

Fix image paths in `frontend/app.json` to existing files in `frontend/assets/images`.

### Error: Network request failed in app

Check:
- `EXPO_PUBLIC_BACKEND_URL` in `eas.json` points to Render backend URL
- Render backend service is running

### Error: CORS blocked in web

Add web domain to Render `CORS_ORIGINS`, redeploy backend.

### Error: First API call slow

Render free tier may cold start. Upgrade plan if needed.

---

## 11. Minimal Command Set (Quick Copy)

Local backend:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

Local frontend:

```bash
cd frontend
npm install
npx expo start
```

APK:

```bash
cd frontend
eas login
eas build -p android --profile preview
```

Production AAB:

```bash
cd frontend
eas build -p android --profile production
```

---

## 12. Ownership Notes

Every time you deploy:
1. Confirm backend URL
2. Confirm env variables
3. Redeploy backend/web
4. Rebuild APK if mobile env changed

Keep this document updated whenever deployment process changes.
