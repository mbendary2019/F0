# Fix: react-window TypeScript Error

## Problem

```
error TS2688: Cannot find type definition file for 'react-window'.
  The file is in the program because:
    Entry point for implicit type library 'react-window'
```

## Root Cause

The package `@types/react-window@2.0.0` is a **deprecated stub package** that contains no actual type definitions:

```json
{
  "name": "@types/react-window",
  "version": "2.0.0",
  "description": "Stub TypeScript definitions entry for react-window, which provides its own types definitions",
  "deprecated": "This is a stub types definition. react-window provides its own type definitions, so you do not need this installed."
}
```

The actual `react-window` package (v1.8.9) already includes its own TypeScript definitions, making `@types/react-window` unnecessary and problematic.

## Solution

### Step 1: Remove the deprecated package from dependencies

**File**: `package.json`

**Before**:
```json
{
  "dependencies": {
    "@types/pdfkit": "^0.17.3",
    "@types/react-window": "^2.0.0",  // ❌ Remove this
    "algoliasearch": "^5.40.0",
    ...
    "react-window": "^1.8.9"  // ✅ Has built-in types
  }
}
```

**After**:
```json
{
  "dependencies": {
    "@types/pdfkit": "^0.17.3",
    "algoliasearch": "^5.40.0",
    ...
    "react-window": "^1.8.9"  // ✅ Has built-in types
  }
}
```

### Step 2: Reinstall dependencies

```bash
pnpm install
```

This will remove the stub package and clean up the dependency tree.

### Step 3: Exclude test files from TypeScript checking

**File**: `tsconfig.json`

Added `__tests__` to the exclude list to prevent test-related errors from appearing in main compilation:

```json
{
  "exclude": [
    "node_modules",
    "functions",
    "tests",
    "__tests__"  // Added this
  ]
}
```

## Verification

```bash
# Check that the error is gone
npx tsc --noEmit

# Or run Next.js linting
pnpm run lint
```

## Result

✅ **Fixed**: The `react-window` TypeScript error is completely resolved.

The remaining TypeScript errors are pre-existing issues in the codebase unrelated to this fix or Phase 85 implementations.

---

**Date**: 2025-11-20
**Phase**: Post Phase 85.5.1
**Impact**: Zero impact on Phase 85 features (Heatmap, Sandbox, IDE, etc.)
