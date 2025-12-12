# Quality Story & Timeline

The **Quality Story Engine** converts raw snapshots into a human-readable story.

## Snapshots

Each `QualityStorySnapshot` is taken after a scan or a CI run and contains:

- `health` – overall project health score (0–100)
- `coverage` – test coverage percentage
- `issues` – total number of detected issues
- `securityAlerts` – number of security alerts (and whether any are blocking)
- `testPassRate` – percentage of passing tests
- `timestamp` – when the snapshot was taken

## Events

From snapshots we derive `QualityStoryEvent` objects, such as:

- **HEALTH_DROP / HEALTH_RISE** – health changed by at least ±5 points
- **COVERAGE_DROP / COVERAGE_RISE** – coverage changed by at least ±1%
- **SECURITY_ALERT / SECURITY_CLEAR** – security status changed
- **ATP_RUN** – Autonomous Test Pipeline completed a cycle
- **AUTO_IMPROVE** – Auto-improve pipeline was triggered
- **DEPLOY** – A deploy was attempted

These events are rendered as chips in the Pre-Deploy Gate timeline.

## Timeline

The **timeline chart** shows the last N snapshots (usually 20).

- Bars are color-coded by health score
- The **last bar** is animated with `f0-quality-bar-last` to highlight the most recent state
- Events are overlaid as dots on the timeline

## Types

```typescript
interface QualityStorySnapshot {
  id: string;
  timestamp: string;
  health: number;
  issues: number;
  status: QualityStatus;
  coverage?: number | null;
  securityAlerts?: number | null;
  testPassRate?: number | null;
}

interface QualityStoryEvent {
  id: string;
  type: QualityStoryEventType;
  timestamp: string;
  title: string;
  description?: string;
  health?: number;
  coverage?: number | null;
  issues?: number;
}
```

## Hook

Use `useQualityStoryEvents()` to access snapshots and events:

```typescript
const { snapshots, events } = useQualityStoryEvents();
```
