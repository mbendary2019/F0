# Quality Narrative Engine

The **Quality Narrative Engine** turns numbers into short paragraphs that read like a human status update.

## Inputs

- Latest `QualityStorySnapshot`
- Full list of snapshots (for trend analysis)
- Derived metrics (deltas) for health, coverage, alerts, and tests
- Locale (`en` or `ar`)

## Output

A `QualityNarrative` contains:

```typescript
interface QualityNarrative {
  status: QualityStatus;
  sections: QualityNarrativeSection[];
  generatedAt: string;
}

interface QualityNarrativeSection {
  id: string;
  type: QualityNarrativeSectionType;
  title: string;
  body: string;
  highlight?: NarrativeHighlight;
}
```

## Section Types

| Type | Icon | Description |
|------|------|-------------|
| `overview` | 📌 | Current health score and status summary |
| `health_trend` | 📈 | Health trajectory (rising/falling/stable) |
| `coverage_trend` | 📊 | Coverage changes over time |
| `security_risks` | 🔐 | Security alerts and blocking issues |
| `testing_activity` | 🧪 | Test runs and pass rates |
| `auto_improve` | ⚡ | Auto-improve pipeline activity |
| `deploy_activity` | 🚀 | Recent deploy attempts |
| `recommendation` | 💡 | Suggested next steps |

## Highlight Levels

- `danger` – Red border, critical issues
- `warning` – Amber border, needs attention
- `info` – Blue border, informational
- `success` – Green border, positive news

## Localization

The engine returns **locale-aware** text for:

- English (`en`)
- Arabic (`ar`)

The UI does not build sentences – it only displays titles, body text, and highlights from the engine.

## Usage

```typescript
import { buildQualityNarrative } from '../../features/quality/qualityNarrativeEngine';

const narrative = buildQualityNarrative({
  status: 'OK',
  snapshots: storySnapshots,
  events: qualityEvents,
  locale: 'en',
});
```

## File Location

`desktop/src/features/quality/qualityNarrativeEngine.ts`
