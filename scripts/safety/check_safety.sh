#!/bin/bash
# Safety Rails Pre-Release Check
# Phase 33.3 Integration

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🛡️  Phase 33.3 Safety Rails Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

pass() {
    echo "✅ PASS: $1"
    ((PASSED++))
}

fail() {
    echo "❌ FAIL: $1"
    ((FAILED++))
}

warn() {
    echo "⚠️  WARN: $1"
    ((WARNINGS++))
}

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. Load Safety Config
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "📋 Loading Safety Configuration..."

if [ ! -f ".phase33_safety_rails.yaml" ]; then
    fail "Safety rails config missing (.phase33_safety_rails.yaml)"
    exit 1
fi

pass "Safety rails config found"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Check Protected Paths
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "🔒 Checking Protected Paths..."

PROTECTED_PATHS=(
    "src/app/(auth)"
    "src/middleware.ts"
    "functions/src/auth"
    "turbo.json"
    "scripts/"
    ".github/workflows/"
)

PROTECTED_MODIFIED=0

for path in "${PROTECTED_PATHS[@]}"; do
    if git diff --name-only HEAD~1 2>/dev/null | grep -q "$path"; then
        warn "Changes detected in protected path: $path"
        ((PROTECTED_MODIFIED++))
    fi
done

if [ $PROTECTED_MODIFIED -eq 0 ]; then
    pass "No protected paths modified"
else
    warn "$PROTECTED_MODIFIED protected path(s) modified - requires security-approved label"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. Check Canary Requirements
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "🚦 Checking Canary Requirements..."

REQUIRES_CANARY=false

# Check if critical files changed
CANARY_TRIGGERS=(
    "turbo.json"
    ".github/workflows/"
    "firebase.json"
    "scripts/"
)

for trigger in "${CANARY_TRIGGERS[@]}"; do
    if git diff --name-only HEAD~1 2>/dev/null | grep -q "$trigger"; then
        REQUIRES_CANARY=true
        warn "Change in $trigger requires canary deployment"
    fi
done

if [ "$REQUIRES_CANARY" = true ]; then
    warn "Canary deployment REQUIRED"
else
    pass "No canary deployment required"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. Check PR/Commit Limits
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "📊 Checking Limits..."

# Files changed
FILES_CHANGED=$(git diff --name-only HEAD~1 2>/dev/null | wc -l)
echo "Files changed: $FILES_CHANGED"

if [ "$FILES_CHANGED" -gt 50 ]; then
    warn "Exceeds file limit (50). Current: $FILES_CHANGED"
else
    pass "Within file limit ($FILES_CHANGED/50)"
fi

# Lines changed
LINES_CHANGED=$(git diff --shortstat HEAD~1 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
echo "Lines changed: $LINES_CHANGED"

if [ "$LINES_CHANGED" -gt 1000 ]; then
    warn "Exceeds line limit (1000). Current: $LINES_CHANGED"
    warn "Requires 2+ reviewers"
else
    pass "Within line limit ($LINES_CHANGED/1000)"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Check Dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "📦 Checking Dependencies..."

# Check if package.json or lockfiles changed
if git diff --name-only HEAD~1 2>/dev/null | grep -qE "(package\.json|pnpm-lock\.yaml|package-lock\.json)"; then
    warn "Dependencies changed - security audit recommended"
    
    # Run audit if pnpm available
    if command -v pnpm &> /dev/null; then
        echo "Running pnpm audit..."
        if pnpm audit --audit-level high 2>&1 | grep -q "vulnerabilities"; then
            warn "Security vulnerabilities detected in dependencies"
        else
            pass "No high-severity vulnerabilities"
        fi
    fi
else
    pass "No dependency changes"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Environment Variables Check
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "🔐 Checking Environment Variables..."

REQUIRED_SECRETS=(
    "FIREBASE_PROJECT_ID"
    "FIREBASE_SERVICE_ACCOUNT"
    "SENTRY_AUTH_TOKEN"
)

MISSING_SECRETS=0

for secret in "${REQUIRED_SECRETS[@]}"; do
    # This check assumes secrets are set in CI environment
    # In local dev, this will warn but not fail
    if [ -z "${!secret}" ]; then
        warn "Secret not set in environment: $secret"
        ((MISSING_SECRETS++))
    fi
done

if [ $MISSING_SECRETS -eq 0 ]; then
    pass "All required secrets configured (CI environment)"
else
    warn "$MISSING_SECRETS secret(s) missing - verify in GitHub Secrets"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SAFETY CHECK SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Passed:   $PASSED"
echo "❌ Failed:   $FAILED"
echo "⚠️  Warnings: $WARNINGS"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "❌ SAFETY CHECK FAILED"
    echo "Fix critical issues before proceeding with release."
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo "⚠️  SAFETY CHECK PASSED WITH WARNINGS"
    echo "Review warnings and ensure proper approvals."
    exit 0
else
    echo "✅ ALL SAFETY CHECKS PASSED"
    echo "Ready for release deployment."
    exit 0
fi


