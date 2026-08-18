# Workflow Automation Capability

Status: **skeleton only** (Phase 0). `supports()` is real (keyword heuristic
against `BusinessContext`); `execute()` returns a typed empty section.

## Planned structure (Phase 3)

As real extraction/generation logic lands, split this flat module into:

```
workflow-automation/
├── agents/       ← extraction agents (triggers, steps, decisions from BusinessContext.processes)
├── generators/   ← implementation artifact generators (e.g. state machine config)
├── validators/   ← beyond the Zod shape check: cycle detection, orphaned steps, etc.
└── schemas/      ← already present
```

See `docs/architecture/ROADMAP.md` Phase 3.
