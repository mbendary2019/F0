# Tests

Basic unit tests for the Admin RBAC system.

## Running Tests

### Without test framework (basic validation)
```bash
node tests/api-me.test.ts
node tests/admin-rbac.test.ts
```

### With Vitest (recommended)
First install vitest:
```bash
npm install -D vitest
```

Add to package.json scripts:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Then run:
```bash
npm test
```

## Test Coverage

- `/api/me` endpoint structure
- Admin RBAC endpoint validation
- Role grant/revoke request body validation

## Future Enhancements

- Integration tests with Firebase emulator
- E2E tests for Admin UI
- Test coverage for audit logging

