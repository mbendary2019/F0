# 🚀 From Zero - Quick Start Guide

> Get up and running in 3 steps!

## ⚡ Quick Start (3 Steps Only!)

### Step 1️⃣: Setup Environment

```bash
# Copy the template
cp .env.local.example .env.local

# Edit with your Firebase values
nano .env.local
```

### Step 2️⃣: Run Everything

```bash
./start-local.sh
```

This script will automatically:
- ✅ Check all requirements (Node, pnpm, Firebase CLI)
- ✅ Install dependencies if needed
- ✅ Build Functions
- ✅ Start Firebase Emulators
- ✅ Seed initial data
- ✅ Start Next.js on port 3000
- ✅ Start Orchestrator (optional)

### Step 3️⃣: Open Browser

```
http://localhost:3000
```

**That's it! 🎉**

---

## 📋 Essential Commands

| Command | Description |
|---------|-------------|
| `./start-local.sh` | **Start everything locally** (recommended) |
| `./stop-local.sh` | Stop all services |
| `./quick-test.sh` | Run smoke tests |
| `./deploy-production.sh all` | Deploy to production |
| `node scripts/seed-all.js` | Seed initial data |

---

## 🌐 Available Services

After running `./start-local.sh`:

| Service | URL | Description |
|---------|-----|-------------|
| **Next.js** | http://localhost:3000 | Main app |
| **Firestore** | http://localhost:8080 | Database |
| **Auth** | http://localhost:9099 | Authentication |
| **Functions** | http://localhost:5001 | Cloud Functions |
| **Orchestrator** | http://localhost:9090 | AI Orchestrator (optional) |

---

## 📊 Seeded Data

When running with data seeding, you'll get:

| Collection | Documents | Description |
|-----------|-----------|-------------|
| `ops_branding` | `prod` | Branding settings |
| `ops_billing_plans` | `trial`, `starter`, `pro` | 3 billing plans |
| `ops_marketplace_items` | 3 docs | Free marketplace items |
| `ops_marketplace_paid` | 2 docs | Premium items |
| `ops_system_settings` | `global` | System settings |

**Total: 10 documents in 5 collections** ✅

---

## 🔧 Manual Setup (Alternative)

If you prefer manual setup:

```bash
# 1. Install dependencies
pnpm install
cd functions && npm install && cd ..

# 2. Start Firebase Emulators
firebase emulators:start --only functions,firestore,auth

# 3. In another terminal, seed data
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js

# 4. In another terminal, start Next.js
pnpm dev

# 5. (Optional) Start Orchestrator
cd orchestrator && pnpm dev
```

---

## 🚢 Deployment

### Full Deployment

```bash
./deploy-production.sh all
```

### Selective Deployment

```bash
./deploy-production.sh functions   # Functions only
./deploy-production.sh hosting     # Hosting only
./deploy-production.sh firestore   # Rules + Indexes
```

---

## 🛠️ Troubleshooting

### Port in use

```bash
./stop-local.sh
```

### No data showing

```bash
FIRESTORE_EMULATOR_HOST=localhost:8080 node scripts/seed-all.js
```

### Functions not working

```bash
cd functions && npm run build && cd ..
firebase emulators:restart
```

---

## 📚 Documentation

- **[START-HERE-AR.md](./START-HERE-AR.md)** - Complete guide in Arabic
- **[دليل-التشغيل-السريع.md](./دليل-التشغيل-السريع.md)** - Detailed guide in Arabic
- **[COMMANDS-CHEATSHEET.md](./COMMANDS-CHEATSHEET.md)** - All commands reference
- **[PHASE_48_COMPLETE.md](./PHASE_48_COMPLETE.md)** - Latest phase completion

---

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review [START-HERE-AR.md](./START-HERE-AR.md)
3. Check logs: `tail -f logs/*.log`
4. Open an issue on GitHub
5. Email: support@fromzero.app

---

## ✅ Requirements

- Node.js v22.x ✅
- pnpm ✅
- Firebase CLI ✅

Check with:
```bash
node -v && pnpm -v && firebase --version
```

---

**Made with ❤️ by the From Zero team**

**Last updated:** 2025-10-14
**Version:** 1.0.0
**Status:** ✅ Production Ready
