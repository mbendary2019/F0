# F0 Quality Gate

The **F0 Quality Gate** is the final checkpoint before any production deploy.

It consumes data from multiple watchdogs and services:

- **Code Health Watchdog** – static analysis, issues, technical debt
- **Coverage Watchdog** – test coverage per file and per project
- **Security Watchdog** – security alerts and blocking incidents
- **Autonomous Test Pipeline (ATP)** – number of tests and last run status
- **Quality Story Engine** – historical snapshots and trends

## Gate Status

The gate exposes three main statuses:

- **READY** – Health above the configured threshold, no blocking security alerts.
- **CAUTION** – Deploy is allowed but there are warnings (low coverage, stale tests, or medium-risk issues).
- **BLOCKED** – Deploy is blocked because of at least one blocking condition:
  - High-severity security alerts
  - Health below minimum threshold
  - Critical policy violations

Gate thresholds are configured via the **Quality Settings** profiles in the app:
Strict, Balanced, Relaxed, and Custom.

## Policy Engine

The policy engine evaluates:

1. **Health threshold** – minimum acceptable health score (0-100)
2. **Coverage threshold** – minimum test coverage percentage
3. **Security policy** – whether blocking alerts should block deploys
4. **Test policy** – whether failing tests should block deploys

## Integration Points

- `PreDeployGateModal.tsx` – Main UI surface
- `policyEngine.ts` – Policy evaluation logic
- `deployQualityContext.ts` – State management for gate data
