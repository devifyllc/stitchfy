# Security & Governance Capability

Status: **fully implemented capability** — the third non-website capability
(after Workflow Automation and Integrations) to go from structured
selection through a validated, artifact-producing specification, and the
first **cross-cutting** one: it inspects both of those capabilities'
already-generated output rather than producing its own artifact from
Discovery alone. `implemented: true` means Stitchfy generated and
validated a security/governance architecture for the currently known
solution — it does **not** mean the resulting system is secure, compliant,
certified, penetration-tested, or production-ready. No real IAM, secrets
manager, encryption configuration, or compliance product integration
exists anywhere in this module.

## Pipeline

```
DiscoveryResult
     ↓ security-governance.assessor.ts   (structured, explainable selection)
CapabilityAssessment
     ↓ execute() reads context.capabilityResults for workflow-automation + integrations output
DiscoveryResult + WorkflowDefinition[] + IntegrationDefinition[]
     ↓ generators/security-architecture.generator.ts   (SecurityArchitecture, incl. RiskAssessment[])
     ↓ generators/governance-plan.generator.ts          (GovernancePlan)
SecurityArchitecture, GovernancePlan
     ↓ validators/security-architecture.validator.ts    (referential integrity, evidence-required checks)
     ↓ generators/security-artifact.generator.ts        (JSON + Markdown ×3)
ImplementationArtifact[]  →  output/artifacts/security-governance/
```

## Structure

```
security-governance/
├── generators/
│   ├── security-architecture.generator.ts   ← builds SecurityArchitecture (incl. risks)
│   ├── governance-plan.generator.ts         ← builds GovernancePlan
│   └── security-artifact.generator.ts       ← JSON + Markdown artifacts
├── validators/
│   └── security-architecture.validator.ts   ← referential integrity, same-system boundary, evidence checks
├── schemas/
│   ├── security-governance.types.ts
│   └── security-governance.schema.ts
├── security-governance.assessor.ts   ← structured, explainable supports()/assess()
└── security-governance.capability.ts
```

## Key design points

- **Cross-cutting, without a new orchestration mechanism.** Assessment
  (`assessSecurityGovernance()`) only ever sees `DiscoveryResult` —
  `WorkflowDefinition[]`/`IntegrationDefinition[]` don't exist yet at
  planning time. `execute()` (which runs later, in the `"capabilities"`
  stage) reads `context.capabilityResults` for both sibling outputs — the
  same pattern Integrations already used for one sibling in Phase 4, now
  reused for two. `default-capabilities.ts`'s registration order
  (`workflow-automation` → `integrations` → `security-governance`) already
  provides correct ordering; no `dependsOn`/`executionOrder` field exists.
- **Never blocked by its own blocking gaps.** Unlike other capabilities, a
  blocking Discovery gap doesn't set this capability's assessment to
  `"blocked"` — its entire purpose is to surface unresolved
  security-relevant facts, so a blocking gap is exactly the kind of thing
  it should report *on*.
- **`ArchitectureReference` vs. `EvidenceReference`** — `EvidenceReference`
  answers "why was this decided" (points at a Discovery entity);
  `ArchitectureReference` answers "what part of the generated solution
  does this apply to" (points at a workflow/step/integration/system/data
  contract/process/requirement/approval). Kept as two separate contracts
  so it's never ambiguous which question either one answers.
- **Trust boundaries never invent network topology.** `classifyBoundary()`
  only ever produces `"external"`, `"third-party"` (target system category
  `saas`/`cloud-service`), or `"unknown"` — no VPC/DMZ/public/private
  concept exists in the model. A boundary is only generated per real
  `IntegrationDefinition`, never for a system that merely appears in
  Discovery.
- **Authentication is consumed, never re-derived.** The mechanism Phase 4
  already resolved (`api-key`, `oauth2`, `unknown`, ...) is quoted verbatim
  into the generated secrets requirement — never silently upgraded or
  downgraded. `unknown`/`none` produce no secrets requirement. Identity and
  authorization are matched by independent regexes against the same text —
  one is never inferred from the other.
- **Risk vs. information gap stays distinct.** A bare unresolved fact (e.g.
  "authentication provider not yet selected") stays an
  `InformationGapReference`; a `RiskAssessment` is only generated for an
  identified adverse *condition* (known non-`none` auth mechanism →
  credential-exposure risk; sensitive/unresolved data crossing an
  external/third-party boundary → privacy risk). `likelihood`/`impact`
  always stay `"unknown"` — no numeric score or likelihood×impact
  calculation exists.
- **Compliance stays restrained.** `"explicit"` only fires on an exact
  framework-name match (PCI DSS, HIPAA, SOC 2, GDPR, CCPA, COPPA, PIPEDA,
  ISO 27001, HITECH) against already-structured Discovery text.
  `"potential"` requires both sensitive/unresolved data *and* an
  external/third-party boundary, and never assigns a specific framework —
  only a generic privacy-review rationale, worded from the actual matched
  boundary classification(s).
- **Human oversight and audit reuse the existing HITL model.** Both derive
  from the `WorkflowApproval`s Workflow Automation already generates —
  `SecurityArchitecture` holds the security view (a `human-oversight`
  `SecurityRequirement`), `GovernancePlan` holds the governance-control
  view (`GovernanceApprovalControl`) — two projections of the same
  evidence, not a competing approval model. `GovernancePlan.auditRequirements`
  reuses `SecurityArchitecture.auditRequirements` directly rather than
  regenerating them.
- **Language discipline.** Every generated artifact repeats the
  `implemented: true` disclaimer verbatim and never asserts "secure,"
  "compliant," or "certified" as a claim about the solution itself —
  only "security requirement," "consideration," "requires review."

See `docs/architecture/ARCHITECTURE.md` "Security, Governance and Risk
Architecture" for the full design rationale, and
`docs/architecture/ROADMAP.md` for **Phase 5.5 — Integration Provider /
Export Adapters** and beyond.
