# Phase 50 — Quick Start Guide

**Get started with UI/UX & Localization in 10 minutes**

---

## 🚀 Current Status

✅ **Working:**
- next-intl configured
- Arabic (AR) and English (EN) routes
- 77 translation keys in both languages
- Middleware for automatic routing

⚠️ **Needs Work:**
- Add Phase 49 translations (Incidents)
- Unify Sidebar dimensions
- Implement Theme system
- Create Language Switcher component

---

## 📖 Quick Reference

### 1. Using Translations in Components

```typescript
// Server Component
import {getTranslations} from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('home');

  return <h1>{t('title')}</h1>;
}

// Client Component
'use client';
import {useTranslations} from 'next-intl';

export default function ClientPage() {
  const t = useTranslations('home');

  return <h1>{t('title')}</h1>;
}
```

### 2. Getting Current Locale

```typescript
import {useLocale} from 'next-intl';

export default function MyComponent() {
  const locale = useLocale(); // 'ar' or 'en'

  return <div>Current locale: {locale}</div>;
}
```

### 3. Language Links

```typescript
import {Link} from 'next-intl';

export default function Navigation() {
  return (
    <nav>
      <Link href="/dashboard">Dashboard</Link>
      {/* Automatically uses current locale: /ar/dashboard or /en/dashboard */}
    </nav>
  );
}
```

---

## 🎨 Adding New Translations

### Step 1: Add to en.json

```json
{
  "incidents": {
    "title": "Incident Center",
    "severity": {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "critical": "Critical"
    },
    "export": "Export to CSV"
  }
}
```

### Step 2: Add to ar.json

```json
{
  "incidents": {
    "title": "مركز الحوادث",
    "severity": {
      "low": "منخفض",
      "medium": "متوسط",
      "high": "مرتفع",
      "critical": "حرج"
    },
    "export": "تصدير إلى CSV"
  }
}
```

### Step 3: Use in Component

```typescript
const t = useTranslations('incidents');

<h1>{t('title')}</h1>
<span>{t('severity.low')}</span>
<button>{t('export')}</button>
```

---

## 🌐 Language Switcher Component

Create `components/LanguageSwitcher.tsx`:

```typescript
'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = () => {
    const newLocale = locale === 'ar' ? 'en' : 'ar';
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`);
    router.push(newPath);
  };

  return (
    <button onClick={switchLanguage} className="px-4 py-2 rounded-lg">
      {locale === 'ar' ? 'English' : 'عربي'}
    </button>
  );
}
```

---

## 🎨 Theme System Setup

### Step 1: Create Theme Provider

```typescript
// components/ThemeProvider.tsx
'use client';

import { createContext, useContext, useState, useEffect } from 'react';

type Theme = 'light' | 'dark';

const ThemeContext = createContext<{
  theme: Theme;
  setTheme: (theme: Theme) => void;
}>({ theme: 'light', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
```

### Step 2: Wrap App with Provider

```typescript
// app/[locale]/layout.tsx
import { ThemeProvider } from '@/components/ThemeProvider';

export default function LocaleLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      {children}
    </ThemeProvider>
  );
}
```

### Step 3: Use Theme in Components

```typescript
import { useTheme } from '@/components/ThemeProvider';

export function MyComponent() {
  const { theme, setTheme } = useTheme();

  return (
    <div className={theme === 'dark' ? 'bg-gray-900' : 'bg-white'}>
      <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
        Toggle Theme
      </button>
    </div>
  );
}
```

---

## 📐 Unified Sidebar Specs

```typescript
// components/Sidebar.tsx
const SIDEBAR_CONFIG = {
  width: 260,        // px
  padding: 24,       // 1.5rem
  gap: 12,          // 0.75rem
  itemHeight: 40,   // px
  iconSize: 20,     // px
};

export function Sidebar() {
  return (
    <aside
      className="fixed top-0 h-screen bg-background border-r border-border"
      style={{ width: `${SIDEBAR_CONFIG.width}px` }}
    >
      {/* Content */}
    </aside>
  );
}
```

---

## 🧪 Testing Translations

### Test All Routes

```bash
# Test Arabic routes
curl http://localhost:3000/ar
curl http://localhost:3000/ar/ops/analytics
curl http://localhost:3000/ar/ops/audit

# Test English routes
curl http://localhost:3000/en
curl http://localhost:3000/en/ops/analytics
curl http://localhost:3000/en/ops/audit
```

### Test in Browser

1. **Visit:** http://localhost:3000
2. **Should redirect to:** http://localhost:3000/ar (default locale)
3. **Switch language:** Click language switcher
4. **Should navigate to:** http://localhost:3000/en
5. **Verify:** All text changes language
6. **Check:** RTL/LTR layout switches

---

## 📋 Translation Checklist for Phase 49

Add these to `src/messages/en.json` and `src/messages/ar.json`:

```json
{
  "incidents": {
    "title": "Incident Center",
    "subtitle": "Track and manage system errors",
    "status": {
      "open": "Open",
      "ack": "Acknowledged",
      "resolved": "Resolved"
    },
    "severity": {
      "low": "Low",
      "medium": "Medium",
      "high": "High",
      "critical": "Critical"
    },
    "source": {
      "client": "Client",
      "functions": "Functions",
      "manual": "Manual"
    },
    "level": {
      "error": "Error",
      "warning": "Warning",
      "info": "Info"
    },
    "filters": {
      "dateFrom": "From",
      "dateTo": "To",
      "level": "Level",
      "status": "Status",
      "apply": "Apply Filters",
      "clear": "Clear"
    },
    "table": {
      "id": "ID",
      "timestamp": "Timestamp",
      "level": "Level",
      "source": "Source",
      "message": "Message",
      "status": "Status",
      "actions": "Actions"
    },
    "actions": {
      "view": "View Details",
      "acknowledge": "Acknowledge",
      "resolve": "Resolve",
      "export": "Export to CSV"
    },
    "export": {
      "title": "Export Incidents",
      "format": "Format",
      "download": "Download",
      "success": "Export successful",
      "error": "Export failed"
    },
    "empty": "No incidents found",
    "loading": "Loading incidents..."
  }
}
```

---

## 🎯 Quick Tasks (15 minutes)

### Task 1: Add Missing Translations (5 min)

```bash
# 1. Open en.json
code src/messages/en.json

# 2. Add incidents section (copy from above)

# 3. Open ar.json
code src/messages/ar.json

# 4. Add Arabic translations
```

### Task 2: Create Language Switcher (5 min)

```bash
# 1. Create component
code src/components/LanguageSwitcher.tsx

# 2. Copy code from above

# 3. Add to layout
code src/app/[locale]/layout.tsx
```

### Task 3: Test (5 min)

```bash
# 1. Start dev server
npm run dev

# 2. Visit http://localhost:3000

# 3. Test language switching

# 4. Verify translations appear
```

---

## 📚 Useful Commands

```bash
# Start dev server
npm run dev

# Type check
npm run type-check

# Lint
npm run lint

# Build
npm run build

# Test build locally
npm run start

# Count translation keys
jq 'paths(scalars) as $p | "\($p | join("."))"' src/messages/en.json | wc -l
jq 'paths(scalars) as $p | "\($p | join("."))"' src/messages/ar.json | wc -l

# Compare translation keys
diff <(jq -S 'paths(scalars) as $p | "\($p | join("."))"' src/messages/en.json) \
     <(jq -S 'paths(scalars) as $p | "\($p | join("."))"' src/messages/ar.json)
```

---

## 🐛 Common Issues

### Issue: "Locale not found"
**Solution:** Check middleware config includes the locale

### Issue: Hydration error
**Solution:** Use `'use client'` for components using `useTranslations`

### Issue: Translation not updating
**Solution:** Restart dev server after modifying JSON files

### Issue: RTL not working
**Solution:** Check `dir` attribute on `<html>` element

---

## 📖 Full Documentation

- [PHASE_50_UI_UX_LOCALIZATION.md](PHASE_50_UI_UX_LOCALIZATION.md) - Complete guide
- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [Next.js i18n](https://nextjs.org/docs/app/building-your-application/routing/internationalization)

---

**Status:** Day 1 - Translation Audit ✅
**Next:** Day 2 - Middleware Optimization
**Last Updated:** 2025-11-05
