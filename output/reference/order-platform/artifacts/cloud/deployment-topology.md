# Deployment Topology

> `implemented: true` on this capability means Stitchfy generated and validated a vendor-neutral cloud/deployment architecture for the currently known solution. It does not mean infrastructure was provisioned, an application was deployed, a cloud account or credentials exist, a region was selected (unless explicitly required), networking was configured, a database was created, scalability was tested, resilience was verified, or the architecture is production-ready.

## DEPLOYUNIT-001 — Order API

- Kind: api
- Responsibility: solution-managed
- Workload profile: request-driven
- Runtime requirement(s): RUNTIME-001
- State requirement(s): none
- Connectivity requirement(s): CONNECT-002
- Evidence: 1 reference(s)

## DEPLOYUNIT-002 — Order Processor

- Kind: worker
- Responsibility: solution-managed
- Workload profile: background
- Runtime requirement(s): RUNTIME-002
- State requirement(s): none
- Connectivity requirement(s): CONNECT-001, CONNECT-003
- Evidence: 1 reference(s)

## External Systems Referenced

- Fulfillment API _(external, not a deployment unit)_
