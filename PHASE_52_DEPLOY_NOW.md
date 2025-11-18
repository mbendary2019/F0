# Phase 52 — Deploy Now! 🚀

**Status:** ✅ Ready for deployment
**Date:** 2025-11-05

---

## ⚡ Quick Deploy Commands

### 1. Build Functions
```bash
cd functions
npm install
npm run build
```

### 2. Deploy Functions
```bash
firebase deploy --only functions
```

### 3. Verify Deployment
```bash
firebase functions:list
```

---

## ✅ Pre-Deployment Checklist

- [x] Environment variables configured in `functions/.env`
- [x] `.env` added to `.gitignore`
- [x] AES-256-GCM encryption implemented
- [x] Firestore schemas updated
- [x] Security rules deployed (Ruleset: 26b7460b-a36b-4c03-bcf2-fdfe6860a1cc)
- [x] OAuth functions updated
- [x] Repository management functions updated

---

## 🔧 Functions to Deploy

### OAuth Functions
- ✅ `exchangeOAuthCode` - Exchange authorization code for access token
- ✅ `revokeGitHubConnection` - Disconnect GitHub account
- ✅ `getGitHubAccount` - Get connection status

### Repository Functions
- ✅ `listRepositories` - Fetch user's GitHub repositories
- ✅ `connectRepository` - Link repository to F0
- ✅ `disconnectRepository` - Unlink repository
- ✅ `getConnectedRepositories` - List connected repos
- ✅ `updateRepositorySettings` - Update sync settings

---

## 🧪 Post-Deployment Testing

### Test OAuth Flow
1. Navigate to `/ops/github` in your app
2. Click "Connect GitHub"
3. Authorize the app on GitHub
4. Verify account info appears
5. Check Firestore for `ops_github_accounts/<uid>` document

### Test Repository Management
```typescript
// 1. List repositories
const listRepos = httpsCallable(functions, 'listRepositories');
const result = await listRepos({page: 1, perPage: 10});
console.log(result.data.repos);

// 2. Connect a repository
const connectRepo = httpsCallable(functions, 'connectRepository');
await connectRepo({
  repoId: 123456,
  fullName: 'username/repo',
  syncEnabled: true
});

// 3. Get connected repos
const getRepos = httpsCallable(functions, 'getConnectedRepositories');
const repos = await getRepos({});
console.log(repos.data.repos);
```

### Verify Firestore Data
```bash
# Check ops_github_accounts
firebase firestore:get ops_github_accounts/<your-uid>

# Check ops_github_repos
firebase firestore:list ops_github_repos
```

---

## 🔒 Security Verification

### Environment Variables
```bash
# Verify .env is NOT committed
git status | grep ".env"
# Should show nothing (file is gitignored)

# Verify .env exists locally
ls -la functions/.env
# Should show the file
```

### Encryption Key
```bash
# Verify key length (should be 64 hex characters = 32 bytes)
grep "TOKEN_ENCRYPTION_KEY" functions/.env | cut -d= -f2 | wc -c
# Should output: 65 (64 chars + newline)
```

### Firestore Rules
```bash
# Verify rules are deployed
firebase firestore:rules
```

---

## 📊 Expected Output

### Successful Deployment
```
✔  functions[us-central1-exchangeOAuthCode(us-central1)] Successful update operation.
✔  functions[us-central1-revokeGitHubConnection(us-central1)] Successful update operation.
✔  functions[us-central1-getGitHubAccount(us-central1)] Successful update operation.
✔  functions[us-central1-listRepositories(us-central1)] Successful update operation.
✔  functions[us-central1-connectRepository(us-central1)] Successful update operation.
✔  functions[us-central1-disconnectRepository(us-central1)] Successful update operation.
✔  functions[us-central1-getConnectedRepositories(us-central1)] Successful update operation.
✔  functions[us-central1-updateRepositorySettings(us-central1)] Successful update operation.

✔  Deploy complete!
```

### Successful OAuth Test
```json
{
  "success": true,
  "user": {
    "login": "octocat",
    "name": "The Octocat",
    "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4"
  }
}
```

### Firestore Document (ops_github_accounts)
```json
{
  "userId": "abc123",
  "login": "octocat",
  "avatarUrl": "https://avatars.githubusercontent.com/u/1?v=4",
  "scopes": ["repo", "user:email"],
  "connectedAt": "2025-11-05T10:00:00.000Z",
  "tokenEnc": {
    "alg": "aes-256-gcm",
    "iv": "random-base64-iv",
    "ct": "encrypted-base64-ciphertext",
    "tag": "auth-tag-base64"
  }
}
```

---

## 🐛 Troubleshooting

### Error: "Encryption key not configured"
**Solution:**
```bash
# Verify .env file exists
cat functions/.env | grep TOKEN_ENCRYPTION_KEY

# If missing, add it
echo "TOKEN_ENCRYPTION_KEY=41982f452ac8d6a4135eaa834f7481a6afb230c5307b60c5e8761eeb54b5417c" >> functions/.env
```

### Error: "Failed to exchange code for token"
**Solution:**
1. Verify GitHub OAuth app settings
2. Check redirect URI matches exactly
3. Verify client ID and secret are correct

### Error: "User must be authenticated"
**Solution:**
1. Ensure user is logged in with Firebase Auth
2. Check `context.auth.uid` is present
3. Verify Firebase Auth is initialized

### Error: "GitHub account not connected"
**Solution:**
1. User needs to complete OAuth flow first
2. Check `ops_github_accounts/<uid>` document exists
3. Verify tokenEnc field is present and valid

---

## 📝 Environment Variables Reference

```bash
# GitHub OAuth Configuration
GITHUB_CLIENT_ID=Ov23li9OjAw9N9OKNo0n
GITHUB_CLIENT_SECRET=42a3cabd8432a0d6c66c4025336f1b0268f919b9
GITHUB_REDIRECT_URI=https://from-zero-84253.web.app/api/github/callback

# Token Encryption Key (32 bytes = 64 hex chars)
TOKEN_ENCRYPTION_KEY=41982f452ac8d6a4135eaa834f7481a6afb230c5307b60c5e8761eeb54b5417c
```

---

## 🎯 Next Steps After Deployment

### Day 2: Webhooks & Activity Tracking
- [ ] Implement webhook handler function
- [ ] Verify webhook signatures (HMAC SHA-256)
- [ ] Parse push, pull_request, create, delete events
- [ ] Store activity in `ops_github_activity`
- [ ] Configure webhooks on GitHub repos

### Day 3: Repository Sync
- [ ] Implement `syncRepository` function
- [ ] Support push/pull/PR modes
- [ ] Conflict detection and resolution
- [ ] Sync status tracking

### Day 4: UI & Polish
- [ ] Build `/ops/github` dashboard page
- [ ] Build UI components
- [ ] Add translations
- [ ] End-to-end testing

---

## 📚 Documentation

- [PHASE_52_COMPLETE.md](PHASE_52_COMPLETE.md) - Full implementation summary
- [PHASE_52_SCHEMA_UPDATE.md](PHASE_52_SCHEMA_UPDATE.md) - Schema specifications
- [PHASE_52_DAY1_SUMMARY.md](PHASE_52_DAY1_SUMMARY.md) - Day 1 progress

---

**Ready to deploy!** Run the commands above to push Phase 52 to production. 🚀

**Last Updated:** 2025-11-05
