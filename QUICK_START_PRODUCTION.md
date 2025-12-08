# Quick Start - Production Setup

Fast setup guide for production deployment.

## 🚀 Quick Setup (5 Steps)

### Step 1: Configure Environment

Create `api/.env` file:

```env
GEMINI_API_KEY=your_key
GROQ_API_KEY=your_key
FREE_AI_PROVIDER=groq
USE_FREE_AI=true
PORT=3002
DB_ROOT_PASSWORD=titan@147852aS
DB_NAME=titan_academy
DB_USER=app_user
DB_PASSWORD=app_password
DB_PORT=3307
ADMIN_EMAIL=admin@titanacademy.com
ADMIN_PASSWORD=titan@12345&a
SESSION_SECRET=titan@12345&a
```

### Step 2: Start MySQL

```bash
docker compose up -d mysql
```

Wait 30 seconds, then verify:
```bash
docker compose logs mysql | grep "ready for connections"
```

### Step 3: Create Database Tables & Admin User

```bash
# Create users table (inside Docker container)
docker compose exec api node scripts/createUsersTable.js

# Create admin user (inside Docker container)
docker compose exec api node scripts/createAdminUser.js
```

### Step 4: Start All Services

```bash
docker compose up -d
```

## ✅ Verify Setup

```bash
# Check containers
docker compose ps

# Check users table
docker compose exec mysql mysql -u app_user -papp_password titan_academy -e "SELECT email, role FROM users;"

# Check API logs
docker compose logs api | tail -20
```

## 🔐 Login

Visit: `http://your-server-ip:3000/login.html`

- Email: `admin@titanacademy.com`
- Password: `titan@12345&a`

## 📝 Common Commands

```bash
# View logs
docker compose logs -f api

# Restart services
docker compose restart

# Stop services
docker compose down

# Access MySQL
docker compose exec mysql mysql -u app_user -papp_password titan_academy
```

## 🆘 Troubleshooting

**Table not found?**
```bash
docker compose exec api node scripts/createUsersTable.js
```

**Can't login?**
```bash
docker compose exec api node scripts/createAdminUser.js
```

**Port conflict?**
Change `DB_PORT` and `PORT` in `.env`, then restart.

---

For detailed instructions, see [PRODUCTION_SETUP.md](./PRODUCTION_SETUP.md)

