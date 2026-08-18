# Cloud Architecture Capability

Status: **skeleton only** (Phase 0). Vendor-neutral by design — see
`framework/providers/cloud/cloud-provider.types.ts` for where a concrete
AWS/Azure/GCP adapter would plug in. See `docs/architecture/ROADMAP.md` Phase 7.

## Planned structure

```
cloud/
├── architecture/   ← compute/storage/networking derivation
├── deployment/     ← deployment strategy generators
├── resilience/     ← resilience/scalability recommendations
├── validators/
└── schemas/        ← already present
```
