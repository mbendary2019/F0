# Pre-Deploy Quality Modal Architecture

The Pre-Deploy Quality Modal is the main surface where the Quality Gate is visualized.

## Layout

The modal uses a two-column layout on desktop:

### Left Column

1. Gate header (status + message)
2. Quality Actions Panel
3. Quality History Panel
4. Security Alerts Panel
5. **Autonomous Test Pipeline (ATP)** card
6. **Project Optimization** card
7. Quality Story Timeline card
8. Test Coach Diagnosis
9. Coverage Coach Diagnosis

### Right Column

1. **Quality Coach Full Panel** (Auto-Improve Project entry point)
2. Quality Narrative panel + recent quality events (chips)

On smaller viewports, the layout collapses into a single column while preserving card order.

## Data Flow

```
┌─────────────────────────────────────────────────────────┐
│                      Watchdogs                          │
│  (Code Health, Coverage, Security, ATP, Optimization)   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│               Quality Context                           │
│  (deployQualityContext.ts + testLabContext.ts)          │
└───────────────────────┬─────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
        ▼               ▼               ▼
┌───────────────┐ ┌───────────────┐ ┌───────────────┐
│ Policy Engine │ │ Story Engine  │ │ Narrative     │
│               │ │ (snapshots +  │ │ Engine        │
│               │ │  events)      │ │               │
└───────┬───────┘ └───────┬───────┘ └───────┬───────┘
        │               │               │
        └───────────────┼───────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│             PreDeployGateModal.tsx                      │
│                                                         │
│  - Gate status (OK/CAUTION/BLOCK)                       │
│  - Timeline chart                                       │
│  - Narrative sections                                   │
│  - Action buttons (Run ATP, Deploy, Cancel)             │
└─────────────────────────────────────────────────────────┘
```

## User Actions

The user can:

1. **Run ATP** – Trigger Autonomous Test Pipeline
2. **Run Auto-Improve** – Launch auto-fix pipeline
3. **View Full Quality Panel** – Open detailed quality view
4. **Override & Deploy** – Deploy despite warnings (with confirmation)
5. **Cancel** – Close modal without deploying

## CSS Classes

All cards use unified glassmorphism styling:

- `.f0-quality-card` – Main card container
- `.f0-quality-chip` – Event chips with hover effects
- `.f0-quality-bar-last` – Animated last bar in timeline
- `.f0-quality-divider` – Section dividers
- `.f0-quality-status-*` – Status badge variants

## Key Files

| File | Purpose |
|------|---------|
| `PreDeployGateModal.tsx` | Main modal component |
| `PreDeployQualityStory.tsx` | Timeline + Narrative panel |
| `QualityCoachPanelFull.tsx` | Auto-Improve entry point |
| `AutonomousTestPipelinePanel.tsx` | ATP controls |
| `qualityNarrativeEngine.ts` | Narrative generation |
| `policyEngine.ts` | Gate policy evaluation |
| `deployQualityContext.ts` | State management |
