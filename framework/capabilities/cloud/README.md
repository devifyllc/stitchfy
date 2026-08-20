# Cloud Architecture Capability

Status: **fully implemented capability** — the seventh non-website capability (after Workflow Automation, Integrations, AI Agents, Security & Governance, the Integration Export Adapter foundation, and Observability) to go from structured selection through a validated, artifact-producing specification, and the last of the **cross-cutting** capabilities: it inspects `WorkflowDefinition[]`, `IntegrationDefinition[]`, `AIAgentDefinition[]`, `SecurityArchitecture`, `GovernancePlan`, and `ObservabilityArchitecture` — all five already-generated capabilities — rather than producing its own architecture from Discovery alone. `implemented: true` means Stitchfy generated and validated a vendor-neutral cloud/deployment architecture for the currently known solution — it does **not** mean infrastructure was provisioned, an application was deployed, a cloud account or credentials exist, a region was selected (unless explicitly required), networking was configured, a database was created, scalability was tested, resilience was verified, or the architecture is production-ready. No cloud SDK (`aws-sdk`, `@aws-sdk/*`, Azure SDK, Google Cloud SDK), IaC tool (Terraform, OpenTofu, CloudFormation, CDK, Bicep, Pulumi, `kubectl`, `helm`), credential, or network call exists anywhere in this module — `CloudProvider.deploy()` is never invoked.

Cloud Architecture answers **"what deployment/runtime characteristics does this solution require"** — never **"which AWS/Azure/GCP service should we use."** A workflow needing to remember a pending approval becomes a durable `StateRequirement`, not a PostgreSQL/DynamoDB/Redis pick. An AI agent's orchestration logic becomes a `RuntimeRequirement`, not a Lambda/container/GPU choice.

## Pipeline

```
DiscoveryResult (deploymentNeeds: DeploymentNeed[] — Phase 7B)
     ↓ cloud.assessor.ts       (structured, explainable selection)
CapabilityAssessment
     ↓ cloud.planner.ts        (candidate runtime sources — real objects built later)
CloudPlan
     ↓ execute() reads Workflow Automation's, Integrations', AI Agents', Security & Governance's, and Observability's sibling output
WorkflowDefinition[], IntegrationDefinition[], AIAgentDefinition[], SecurityArchitecture, GovernancePlan, ObservabilityArchitecture
     ↓ generators/cloud-architecture.generator.ts   (deployment units, runtime/state/persistence/connectivity/environment/scalability/resilience — all evidence-derived)
CloudArchitecture
     ↓ validators/cloud.validator.ts   (referential integrity, no invented provider/service/VPC/database)
     ↓ generators/cloud-artifact.generator.ts       (JSON/Markdown/Mermaid artifacts)
ImplementationArtifact[]  →  output/artifacts/cloud/
```

## Structure

```
cloud/
├── generators/
│   ├── cloud-architecture.generator.ts   ← the core generator (hosting/provider/units/runtime/state/connectivity/...)
│   └── cloud-artifact.generator.ts       ← CloudArchitecture → JSON/Markdown/Mermaid artifacts
├── validators/
│   └── cloud.validator.ts                ← referential integrity, provenance, provider-service/network denylists
├── schemas/
│   ├── cloud.types.ts
│   └── cloud.schema.ts
├── cloud.assessor.ts   ← structured, explainable supports()/assess()
├── cloud.planner.ts    ← CloudPlan (runtime candidates)
└── cloud.capability.ts

../../discovery/cloud/
├── deployment-need.types.ts        ← the new Discovery entity
└── deployment-needs.extractor.ts   ← extraction from 8 dedicated section-heading aliases
```

## Key design points

- **Registry moved to run last among the real capabilities.** `default-capabilities.ts`'s order is now website, workflow-automation, integrations, ai-agents, **security-governance, observability, cloud**, modernization — Cloud runs strictly after all five capabilities it consumes, reading them via `context.capabilityResults.find(...)`, the same sibling-read pattern every capability since Phase 4 has used, now for five siblings. No `dependsOn`/`executionOrder` field exists or was needed — the fifth confirmation the static registration order is sufficient.
- **`DeploymentNeed` only ever comes from a dedicated section.** `deployment-needs.extractor.ts` scans 8 heading aliases ("Deployment/Runtime/Hosting/Infrastructure/Cloud/Environment/Scalability/Resilience Requirements") — never an incidental "AWS"/"server"/"cloud"/"database" mention elsewhere in the document. It deliberately does **not** use the shared `findSection()` helper (which returns only the first matching alias); a real document could plausibly use more than one of these headings as genuinely separate sections, so this extractor collects from every heading present.
- **Selection signals deliberately exclude "multi-step process" and "integration need."** A human-performed process step or an integration to an external SaaS system is evidence a human or a third party owns the runtime work — never that the *solution itself* does. This is why `appointment-business.md` (Google Calendar/WhatsApp), `invoice-approval.md` (QuickBooks), and `api-integration.md` (an external REST API) never select Cloud. An `AIAgentNeed` is treated differently and is a standalone **supporting** signal (reaching `needs-review` at low confidence): an agent's tools/permissions/autonomy are active software logic the solution would need to host regardless of where model inference eventually runs.
- **Deployment units are restrained by construction.** A `DeploymentUnit` is only ever created from an explicit `solution-managed <Name> that/which...` bullet in a Deployment Requirements section — never one per `WorkflowDefinition`/`IntegrationDefinition`/`AIAgentDefinition`. Multiple workflow/integration/agent objects existing in a solution does **not** automatically produce multiple deployment units or a microservices split; Stitchfy's own capability module names (`workflow-service`, `agent-service`, ...) are design-time framework boundaries, never automatically runtime service boundaries. External systems referenced by integrations (Google Calendar, QuickBooks, a Fulfillment API) are never turned into deployment units — they stay referenced as `external-system` connectivity endpoints.
- **State/persistence never select a database.** A workflow with a real pending approval derives a `durable` `StateRequirement` citing the actual `WorkflowApproval` — the requirement never becomes a `DatabaseResource` or names an engine. `PersistenceRequirement.technology` is always the literal string `"unspecified"`; `consistency` is only populated when a source document states it explicitly.
- **Connectivity replaces `vpcNeeded`/`publicEndpoints` with real references.** Every `ConnectivityRequirement` either reuses a real `IntegrationDefinition` (protocol preserved verbatim — an `sftp` integration never becomes `https`) or resolves from an explicit public/non-public exposure statement about a named deployment unit. No VPC/subnet/NAT/security-group/load-balancer is ever invented — `exposure: "public"` is only set with real supporting evidence.
- **Security/observability are pure reference layers.** `CloudSecurityMapping`/`CloudObservabilityMapping` link to `SecurityRequirement`/`ObservabilityArchitecture` ids that already exist — no new security policy is inferred and no telemetry threshold is recomputed here. No secret-manager product (AWS Secrets Manager, Azure Key Vault, GCP Secret Manager, Vault, a raw env var, a Kubernetes Secret) is ever named. No infrastructure metric (CPU%, memory%, disk%, pod count, node count, container-restart count) is generated — that's deferred to a future exporter once real compute topology exists.
- **Two denylists as defense-in-depth, not exhaustive vendor catalogs.** `cloud.validator.ts` rejects any generated string containing a specific provider service name (Lambda, ECS, EKS, Fargate, EC2, RDS, DynamoDB, S3, SQS, AKS, App Service, Cosmos DB, Azure Functions, GKE, Cloud Run, Cloud Functions, Firestore, Pub/Sub) or a network-implementation term (VPC, subnet, NAT gateway, security group, load balancer, private link, route table, internet gateway) — regression guards, not something the generator is ever expected to need.
- **Two bugs caught during this phase's own verification** (the same category every prior phase has hit): `deployment-needs.extractor.ts`'s persistence pattern used `\brestart\b`, which cannot match inside the plural "restarts" due to JavaScript regex word-boundary rules — "Order processing state must survive application restarts." was silently misclassified as `runtime` instead of `persistence`. And the environment-category pattern's bare `\bproduction\b`/`\bstaging\b` alternatives caused a scalability bullet ("Production must support at least 100 concurrent order submissions.") to be misclassified as `environment` merely because it started with "Production" as a scope qualifier, not an environment declaration — fixed by requiring the literal word "environment(s)" for that category and reordering scalability ahead of it.

See `docs/architecture/ARCHITECTURE.md` "Vendor-Neutral Cloud and Deployment Architecture" for the full design rationale, and `docs/architecture/ROADMAP.md` for **Phase 7C — Cloud / Observability Export & Runtime Provider Adapters** (mirroring the Exporter/Provider split already established in Phases 5.5A/6.5).
