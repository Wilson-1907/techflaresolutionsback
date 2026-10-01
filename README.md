# TechFlare Solutions Backend

Backend services for [TechFlare Solutions](https://www.techflare-solutions.com/).

| Service | Folder | Port | Purpose |
|---------|--------|------|---------|
| Admin Panel | `admin-panel/` | 3001 | Staff console (news, CRM, ops) |
| AI Service | `ai-service/` | 8000 | FastAPI AI microservice |

Frontend repo: https://github.com/Wilson-1907/techflaresolutions

## Quick start

### Admin panel
```bash
cd admin-panel
cp .env.example .env
npm install
npm run dev
```

### AI service
```bash
cd ai-service
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Set `ADMIN_API_KEY` to match the frontend, and `MAIN_SITE_URL` to the deployed frontend URL.
