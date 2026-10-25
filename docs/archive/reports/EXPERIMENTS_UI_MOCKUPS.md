# Experiments Dashboard - UI Mockups

## 1. Main Experiments List Page

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Experiments                                             [+ Create Experiment]│
│ Manage and monitor your A/B tests and feature experiments                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ [Search experiments...]  [Status: All ▼]  [Sort by: Recently Updated ▼] ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ [All (7)] [Running (3)] [Draft (1)] [Completed (1)] [Paused (1)] [...]     │
│                                                                              │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐            │
│ │ ● GPT-4 vs GPT-4.1 Speech   │ │ ○ Chatbot Performance       │            │
│ │   Transcription             │ │   Optimization              │            │
│ │   ┌──────────────────┐      │ │   ┌──────────────────┐      │            │
│ │   │ RUNNING          │      │ │   │ DRAFT            │      │            │
│ │   └──────────────────┘      │ │   └──────────────────┘      │            │
│ │                             │ │                             │            │
│ │ GPT-4.1 will provide 20%    │ │ Optimized caching will      │            │
│ │ faster transcription with   │ │ reduce response time by 40% │            │
│ │ equal or better accuracy    │ │ without affecting quality   │            │
│ │                             │ │                             │            │
│ │ Started Oct 24 • 1,234 users│ │ Created Oct 22              │            │
│ │                             │ │                             │            │
│ │ transcription_latency:      │ │ Not started yet             │            │
│ │ ↓ 28.0% | p < 0.001 ✓      │ │                             │            │
│ │                             │ │                             │            │
│ │ [GPT-4 (50%)] [GPT-4.1 (50%)]│ │ [Standard (50%)]            │            │
│ │                             │ │ [Optimized Cache (50%)]     │            │
│ └─────────────────────────────┘ └─────────────────────────────┘            │
│                                                                              │
│ ┌─────────────────────────────┐ ┌─────────────────────────────┐            │
│ │ ● Expanded Context Window   │ │ ✓ OpenAI vs Anthropic      │            │
│ │   for Code Completion       │ │   for Code Analysis         │            │
│ │   ┌──────────────────┐      │ │   ┌──────────────────┐      │            │
│ │   │ RUNNING          │      │ │   │ COMPLETED        │      │            │
│ │   └──────────────────┘      │ │   └──────────────────┘      │            │
│ │                             │ │                             │            │
│ │ Larger context window will  │ │ Anthropic Claude will       │            │
│ │ improve completion rate     │ │ provide better accuracy     │            │
│ │                             │ │                             │            │
│ │ Started Oct 11 • 5,678 users│ │ Ended Oct 1 • 8,942 users  │            │
│ │                             │ │                             │            │
│ │ acceptance_rate:            │ │ analysis_accuracy:          │            │
│ │ ↑ 13.7% | p < 0.001 ✓      │ │ ↑ 6.8% | p < 0.001 ✓       │            │
│ │                             │ │                             │            │
│ │ [4K Context (50%)]          │ │ [GPT-4 (50%)]              │            │
│ │ [8K Context (50%)]          │ │ [Claude Sonnet (50%)]      │            │
│ └─────────────────────────────┘ └─────────────────────────────┘            │
│                                                                              │
│ Showing 4 of 7 experiments                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2. Experiment Detail Page - Overview Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Experiments                                                        │
│                                                                              │
│ ● GPT-4 vs GPT-4.1 Speech Transcription   [Pause Experiment] [Stop Exp...] │
│ GPT-4.1 will provide 20% faster transcription with equal or better accuracy │
│ [RUNNING] Key: gpt4-vs-gpt41-transcription • Running for 8 days            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ [Overview] [Results] [Metrics] [Configuration]                              │
│                                                                              │
│ ┌────────────────────────────────┐ ┌────────────────────────────────┐      │
│ │ Experiment Details             │ │ Traffic Allocation             │      │
│ │                                │ │                                │      │
│ │ Created                        │ │ GPT-4                    50%   │      │
│ │ October 15, 2025 10:00 AM      │ │ ██████████████████████████     │      │
│ │                                │ │                                │      │
│ │ Started                        │ │ GPT-4.1                  50%   │      │
│ │ October 16, 2025 12:00 AM      │ │ ██████████████████████████     │      │
│ │                                │ │                                │      │
│ │ Hypothesis                     │ │ Actual Distribution            │      │
│ │ GPT-4.1 will provide 20%       │ │ control: 617 (50.0%)          │      │
│ │ faster transcription with      │ │ treatment: 617 (50.0%)        │      │
│ │ equal or better accuracy       │ │                                │      │
│ └────────────────────────────────┘ └────────────────────────────────┘      │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Targeting                                                                ││
│ │                                                                          ││
│ │ Segments                                                                 ││
│ │ [premium_users]                                                          ││
│ │                                                                          ││
│ │ Traffic Percentage                                                       ││
│ │ 100% of eligible users                                                   ││
│ └──────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3. Experiment Detail Page - Results Tab (Eppo-style Scorecards)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Overview] [Results] [Metrics] [Configuration]                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌─────────────────────────┐ ┌─────────────────────────┐                    │
│ │ Transcription Latency   │ │ Transcription Accuracy  │                    │
│ │               [Significant]│ │               [Significant]│                    │
│ ├─────────────────────────┤ ├─────────────────────────┤                    │
│ │ GPT-4                   │ │ GPT-4                   │                    │
│ │ 2340.00 ms              │ │ 95.20%                  │                    │
│ │ ± 450.00 ms             │ │ ± 2.30%                 │                    │
│ │ n = 617                 │ │ n = 617                 │                    │
│ │ ███████████████▌        │ │ ████████████████▌       │                    │
│ ├─────────────────────────┤ ├─────────────────────────┤                    │
│ │ GPT-4.1                 │ │ GPT-4.1                 │                    │
│ │ 1685.00 ms              │ │ 95.80%                  │                    │
│ │ ± 380.00 ms             │ │ ± 2.10%                 │                    │
│ │ n = 617                 │ │ n = 617                 │                    │
│ │ ███████████▌            │ │ █████████████████       │                    │
│ │                         │ │                         │                    │
│ │ ▼ 28.0% decrease     ✓  │ │ ▲ 0.6% increase      ✓  │                    │
│ │                         │ │                         │                    │
│ │ p-value: < 0.001        │ │ p-value: 0.0312         │                    │
│ │ 95% CI: [-32.5%, -23.5%]│ │ 95% CI: [0.05%, 1.15%]  │                    │
│ └─────────────────────────┘ └─────────────────────────┘                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4. Experiment Detail Page - Metrics Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Overview] [Results] [Metrics] [Configuration]                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Transcription Latency                                                    ││
│ │ Daily performance over time                                              ││
│ │                                                                          ││
│ │  2800 ┤                                                                  ││
│ │       │                                                                  ││
│ │  2400 ┤─────●────●────●─────●────●                                      ││
│ │       │                                                                  ││
│ │  2000 ┤                         ─────○────○────○─────○────○             ││
│ │       │                                                                  ││
│ │  1600 ┤────────────────────────────────────────────────────────────     ││
│ │       │                                                                  ││
│ │       └──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────       ││
│ │          Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct         ││
│ │          16   17   18   19   20   21   22   23   24   25   26          ││
│ │                                                                          ││
│ │       ● GPT-4     ○ GPT-4.1                                             ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Transcription Accuracy                                                   ││
│ │ Daily performance over time                                              ││
│ │                                                                          ││
│ │  98%  ┤                              ○────○────○─────○────○             ││
│ │       │                                                                  ││
│ │  96%  ┤                                                                  ││
│ │       │                                                                  ││
│ │  94%  ┤─────●────●────●─────●────●                                      ││
│ │       │                                                                  ││
│ │  92%  ┤────────────────────────────────────────────────────────────     ││
│ │       │                                                                  ││
│ │       └──┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────┬────       ││
│ │          Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct  Oct         ││
│ │          16   17   18   19   20   21   22   23   24   25   26          ││
│ │                                                                          ││
│ │       ● GPT-4     ○ GPT-4.1                                             ││
│ └──────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 5. Experiment Detail Page - Configuration Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [Overview] [Results] [Metrics] [Configuration]                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Variants                                                                 ││
│ │ Experiment variants and their allocation weights                         ││
│ │                                                                          ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ GPT-4                                                         50%  │  ││
│ │ │ Key: control                                              weight  │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ GPT-4.1                                                       50%  │  ││
│ │ │ Key: treatment                                            weight  │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Metrics                                                                  ││
│ │ Metrics being tracked for this experiment                                ││
│ │                                                                          ││
│ │ Primary Metrics                                                          ││
│ │ [transcription latency] [transcription accuracy]                         ││
│ │                                                                          ││
│ │ Secondary Metrics                                                        ││
│ │ [user satisfaction] [retry rate]                                         ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Guardrails                                                    [Edit]    ││
│ │ Safety thresholds that pause the experiment if violated                  ││
│ │                                                                          ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ error rate                                            [OK]         │  ││
│ │ │ Must be < 0.05 (Current: 0.012)                                    │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ cost per minute                                       [OK]         │  ││
│ │ │ Must be < 0.10 (Current: 0.078)                                    │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ └──────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6. Create Experiment Wizard - Step 1 (Basic Info)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ← Back to Experiments                                                        │
│                                                                              │
│ Create New Experiment                                                        │
│ Follow the steps to configure your experiment                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ① Basic Info ──────── ② Variants ─────── ③ Metrics ─────── ④ Targeting ─── │
│   Name and           Define test       Choose what       Define            │
│   hypothesis         variants          to measure        audience          │
│                                                                              │
│ ──────── ⑤ Review                                                           │
│          Review and launch                                                  │
│                                                                              │
│ ┌──────────────────────────────────────────────────────────────────────────┐│
│ │ Basic Info                                                               ││
│ │ Name and hypothesis                                                      ││
│ │                                                                          ││
│ │ Experiment Name *                                                        ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ e.g., New Checkout Flow A/B Test                                   │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ │                                                                          ││
│ │ Experiment Key *                                                         ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ e.g., checkout-flow-test                                           │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ │ Unique identifier used in code (lowercase, hyphens only)                 ││
│ │                                                                          ││
│ │ Hypothesis *                                                             ││
│ │ ┌────────────────────────────────────────────────────────────────────┐  ││
│ │ │ e.g., Simplifying the checkout to 2 steps will increase           │  ││
│ │ │ conversion rate by 15%                                             │  ││
│ │ │                                                                    │  ││
│ │ └────────────────────────────────────────────────────────────────────┘  ││
│ └──────────────────────────────────────────────────────────────────────────┘│
│                                                                              │
│ [Back]                                      [Cancel] [Next]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7. SRM Warning Example

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ⚠ SAMPLE RATIO MISMATCH DETECTED                                            │
│                                                                              │
│ The observed variant distribution differs significantly from expected ratios │
│ (p = 0.0234). This may indicate a randomization issue.                      │
│ Severity: LOW                                                                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8. Empty States

### No Experiments Yet
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                                    🔬                                        │
│                                                                              │
│                          No experiments yet                                  │
│                                                                              │
│          Create your first experiment to start testing and optimizing       │
│                                                                              │
│                     [Create Your First Experiment]                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### No Results Yet
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                                    📊                                        │
│                                                                              │
│                              No Results Yet                                  │
│                                                                              │
│          Results will appear once the experiment starts collecting data     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Principles

1. **Information Hierarchy**: Most important information (status, metrics) is prominently displayed
2. **Visual Feedback**: Color coding for status (green=running, blue=completed, yellow=paused, etc.)
3. **Data Density**: Compact but readable layout maximizing screen usage
4. **Progressive Disclosure**: Details revealed through tabs and expandable sections
5. **Consistency**: Uniform card designs, spacing, and typography
6. **Accessibility**: High contrast, clear labels, keyboard navigation
7. **Responsive**: Adapts to mobile, tablet, and desktop
8. **Actionable**: Clear CTAs (Create, Start, Stop, Pause)
