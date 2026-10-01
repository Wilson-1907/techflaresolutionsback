# Admin Panel

Separate admin console for **TechFlare Solutions**. It runs on its own port and communicates with the main public site via a secure API key.

## What it does

- **Publish news** from the admin panel → appears on the main site `/newsroom`
- **Draft / publish / unpublish / delete** articles remotely
- **Independent login** (panel password, separate from main site user accounts)

## Setup

### 1. Configure the main site (`frontend/`)

Add to `frontend/.env`:

```env
ADMIN_API_KEY="your-shared-secret-key"
```

Run database migration and seed:

```bash
cd frontend
npx prisma db push
npm run db:seed
```

Start the main site:

```bash
npm run dev
# http://localhost:3000
```

### 2. Configure the admin panel

```bash
cd admin-panel
cp .env.example .env
npm install
```

Edit `admin-panel/.env` — **ADMIN_API_KEY must match frontend/.env**:

```env
MAIN_SITE_URL="http://localhost:3000"
ADMIN_API_KEY="your-shared-secret-key"
ADMIN_PANEL_PASSWORD="admin123"
ADMIN_PANEL_SECRET="random-secret-for-cookies"
```

Start the admin panel:

```bash
npm run dev
# http://localhost:3001
```

### 3. Sign in

- Open **http://localhost:3001**
- Password: value of `ADMIN_PANEL_PASSWORD` (default `admin123`)
- Go to **News & Announcements** → create and publish an article
- View it on **http://localhost:3000/newsroom**

## Architecture

```
┌─────────────────────┐         X-Admin-Api-Key          ┌─────────────────────┐
│  Admin Panel :3001  │  ──────────────────────────────► │  Main Site :3000    │
│  (separate app)     │         POST/PATCH /api/news     │  /newsroom (public) │
└─────────────────────┘                                  └──────────┬──────────┘
                                                                      │
                                                                      ▼
                                                               MySQL (shared DB)
```

## API (main site)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/news` | Public | Published articles only |
| GET | `/api/news?all=true` | API key | All articles including drafts |
| POST | `/api/news` | API key | Create article |
| PATCH | `/api/news/[id]` | API key | Update / publish |
| DELETE | `/api/news/[id]` | API key | Delete article |
