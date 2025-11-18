# Phase 62 Day 4 — SSR Fix للـ 500 Error ✅

**المشكلة**: خطأ 500 على `/ar/ops/timeline` بسبب recharts في SSR

**الحل**: تم تطبيق dynamic import لـ recharts مع `ssr: false`

---

## ✅ الإصلاحات المُطبّقة

### **1. TrendMini.tsx - Dynamic Import**

**المشكلة الأصلية**:
```tsx
import { LineChart, Line, ... } from "recharts"; // ❌ يُنفّذ في SSR
```

**الحل المُطبّق**:
```tsx
"use client";
import dynamic from "next/dynamic";

// Dynamic import - لا SSR
const LineChart = dynamic(
  () => import("recharts").then((mod) => mod.LineChart),
  { ssr: false }
);
// ... باقي المكونات
```

### **2. إضافة mounted state**

```tsx
const [mounted, setMounted] = useState(false);

useEffect(() => {
  setMounted(true); // يُنفّذ فقط في العميل
}, []);

// عرض loading أثناء SSR
if (!mounted) {
  return <div>Loading chart...</div>;
}
```

---

## 🧪 التحقق من الإصلاح

### **خطوات التحقق**:

```bash
# 1. نظّف البناء
rm -rf .next .turbo node_modules/.cache

# 2. ثبّت التبعيات
pnpm i --frozen-lockfile

# 3. شغّل dev server
pnpm dev

# 4. اختبر المسارات
curl -I http://localhost:3000/ops/timeline
# ✅ HTTP/1.1 307 → /ar/ops/timeline

curl -I http://localhost:3000/ar/ops/timeline
# ✅ HTTP/1.1 200 OK

curl -I http://localhost:3000/en/ops/timeline
# ✅ HTTP/1.1 200 OK
```

### **النتائج**:

| المسار | الحالة | الملاحظات |
|--------|--------|-----------|
| `/ops/timeline` | ✅ 307 Redirect | يُوجّه إلى `/ar/ops/timeline` |
| `/ar/ops/timeline` | ✅ 200 OK | يعمل بشكل صحيح |
| `/en/ops/timeline` | ✅ 200 OK | يعمل بشكل صحيح |

---

## 🔧 التفاصيل التقنية

### **لماذا حدث الخطأ 500؟**

1. **recharts يستخدم APIs متصفّح فقط**:
   - `window`, `document`, `navigator`
   - لا تتوفر هذه الـ APIs في Node.js (SSR)

2. **App Router ينفّذ SSR افتراضياً**:
   - حتى مع `"use client"`، Next.js يُحاول pre-render
   - recharts يفشل أثناء SSR

3. **الحل: Dynamic Import + ssr: false**:
   - تأخير تحميل recharts حتى العميل
   - تخطي SSR تماماً للمكونات التي تستخدم recharts

### **الفرق بين "use client" و dynamic import**:

```tsx
// ❌ "use client" وحده لا يكفي
"use client";
import { LineChart } from "recharts"; // يُحاول SSR

// ✅ dynamic import مع ssr: false
"use client";
const LineChart = dynamic(
  () => import("recharts").then(m => m.LineChart),
  { ssr: false } // يتخطى SSR تماماً
);
```

---

## 📝 دليل استكشاف أخطاء SSR

### **أعراض مشاكل SSR**:
- ✅ 500 Internal Server Error على routes معينة
- ✅ Errors تذكر `window is not defined`
- ✅ Errors تذكر `document is not defined`
- ✅ Errors من مكتبات client-only (charts, maps, editors)

### **الحلول**:

#### **1. Dynamic Import (الأفضل)**
```tsx
import dynamic from "next/dynamic";

const Chart = dynamic(
  () => import("./Chart"),
  { ssr: false, loading: () => <div>Loading...</div> }
);
```

#### **2. Client-Only Wrapper**
```tsx
"use client";
import { useEffect, useState } from "react";

export function ClientOnly({ children }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return children;
}
```

#### **3. Conditional Rendering**
```tsx
if (typeof window === "undefined") {
  return <div>Loading...</div>;
}
```

---

## 🎯 Best Practices

### **للمكتبات Client-Only**:

```tsx
// ✅ استخدم dynamic import
import dynamic from "next/dynamic";

const ClientComponent = dynamic(
  () => import("./ClientComponent"),
  {
    ssr: false,
    loading: () => <LoadingSpinner />
  }
);
```

### **للـ Hooks التي تستخدم DOM APIs**:

```tsx
"use client";
import { useEffect, useState } from "react";

export function useWindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    // ✅ يُنفّذ فقط في العميل
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return size;
}
```

### **للمكونات المعقّدة**:

```tsx
"use client";
import { useState, useEffect } from "react";

export function ComplexChart({ data }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ لا تُرسم الـ chart حتى mounted
  if (!mounted) {
    return (
      <div className="chart-placeholder">
        Loading chart...
      </div>
    );
  }

  return <ActualChart data={data} />;
}
```

---

## 🚀 الخلاصة

**الإصلاح المُطبّق**:
- ✅ Dynamic import لجميع مكونات recharts
- ✅ إضافة `ssr: false` flag
- ✅ إضافة mounted state للتحقق
- ✅ Loading state أثناء hydration

**النتيجة**:
- ✅ لا أخطاء 500
- ✅ كل المسارات تعمل (ar/en)
- ✅ TrendMini يُحمّل فقط في العميل
- ✅ تجربة مستخدم سلسة

**Port الصحيح**: `http://localhost:3000` (ليس 3030)

**افتح Timeline الآن**:
```bash
open http://localhost:3000/ops/timeline
```

🎉 **المشكلة محلولة تماماً!**
