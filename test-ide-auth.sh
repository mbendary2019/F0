#!/bin/bash

# Phase 84.7 - IDE Authentication Testing Script
# Tests all error scenarios for IDE endpoints

echo "=== Phase 84.7 IDE Authentication Tests ==="
echo ""

BASE_URL="http://localhost:3030"

# Test 1: Session endpoint with missing token (expect 401)
echo "Test 1: POST /api/ide/session (missing token - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/ide/session" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test-project","clientKind":"vscode"}' | jq .
echo ""

# Test 2: Session endpoint with invalid token (expect 401)
echo "Test 2: POST /api/ide/session (invalid token - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/ide/session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer INVALID_TOKEN_12345" \
  -d '{"projectId":"test-project","clientKind":"vscode"}' | jq .
echo ""

# Test 3: Chat endpoint with missing token (expect 401)
echo "Test 3: POST /api/ide/chat (missing token - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/ide/chat" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"test-session","projectId":"test-project","message":"Help me"}' | jq .
echo ""

# Test 4: Project validate with missing token (expect 401)
echo "Test 4: POST /api/ide/project/validate (missing token - expect 401)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/ide/project/validate" \
  -H "Content-Type: application/json" \
  -d '{"projectId":"test-project"}' | jq .
echo ""

# Test 5: Session endpoint with missing projectId (expect 400)
echo "Test 5: POST /api/ide/session (missing projectId - expect 400)"
curl -s -w "\nHTTP Status: %{http_code}\n" \
  -X POST "$BASE_URL/api/ide/session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SOME_TOKEN" \
  -d '{"clientKind":"vscode"}' | jq .
echo ""

echo "=== Tests Complete ==="
echo ""
echo "Expected Results:"
echo "  Test 1-4: HTTP 401 with 'Unauthorized' error"
echo "  Test 5: HTTP 400 with 'Missing projectId' error"
echo ""
echo "Note: To test 403 (NOT_OWNER), you need a valid token for a user"
echo "      who doesn't own the specified project."
