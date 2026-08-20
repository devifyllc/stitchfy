# Project: <Business Name>

<!--
Starter template for a legacy-modernization assessment or migration scenario.
Builds on templates/solution/business-automation.md for
Business/Goals/Users; this template focuses on the modernization-specific
headings.

Every heading marked (real heading) below is genuinely recognized by
Stitchfy's discovery layer. The final section is marked
(documentation only) because it is NOT parsed — see the note there.
-->

## Existing Systems
- **<System Name>:** <one line — what it is, in plain terms>
<!-- Repeat one bullet per system in scope. A system named ONLY inside
     "## Preservation Requirements" below is never promoted into
     modernization scope — name every in-scope system here explicitly. -->

## Integrations
- The <System> sends/reads/writes <what> to/from <Other System>.
  Integration method: <REST over HTTPS / JDBC / ... — leave out if unknown>

## Modernization Requirements
<!-- (real heading — aliases: "Legacy Systems", "Legacy Application", "Migration Requirements") -->
- <e.g. "The business wants to modernize <System>.">
- <e.g. "The application must move from <current platform> to <target platform> while preserving application behavior." — leave the target platform out entirely if it is not yet decided; do not guess one>
- <e.g. "Existing <X> behavior must remain unchanged / must remain compatible." — this is preservation language and will be captured as a PreservationRequirement automatically>
- <e.g. "The migration must allow the current and modernized versions to coexist during validation." — only if actually required>
- <e.g. "No cloud provider has been selected." / "No migration strategy has been selected." — explicit "not yet decided" is preferred over silence>

## Modernization Drivers
<!-- (real heading) -->
- <e.g. "Reduce dependency on the existing platform.">
- <e.g. "Improve maintainability." / "Reduce licensing cost." / "Address end-of-life support.">

## Preservation Requirements
<!-- (real heading) -->
- <e.g. "<Database/behavior/integration> must not change during this modernization phase.">

## Migration Constraints
<!-- (real heading — alias: "Legacy Constraints") -->
- <e.g. "Database technology must remain unchanged.">
- <e.g. "Production cutover approach has not been selected.">

## Target State Requirements
<!-- (real heading — feeds the same bucket as "Modernization Goals") -->
- <e.g. "The application should run on a supported, maintainable platform." — a specific target TECHNOLOGY belongs in "## Modernization Requirements" above (the "move from X to Y" bullet); this section is for the desired end-state in business terms>

## Deployment Requirements
<!-- (real heading, optional — shared alias family with templates/solution/cloud-deployment.md; only include if the modernized system's hosting is itself an explicit requirement) -->
- <e.g. "The modernized application must remain deployable to the existing data center." — optional>

## Validation Expectations (documentation only)
<!--
There is no parsed "Validation Requirements" heading — a heading with that
exact name would be silently ignored. Once a migration strategy is
explicitly approved AND repository evidence is available (via
`--codebase`/`--system-id`), Stitchfy's generic-java-replatform exporter
derives a TestImpactSpecification and MigrationValidationPlan automatically
from the Preservation Requirements above plus any Security/Observability
requirements already generated — nothing needs to be typed here for that to
happen. Use this section only as free-form context for human reviewers; it
is not read by any extractor.
-->
- <optional prose notes for reviewers>

## Desired Outcomes
- <what "done" looks like for this modernization>

<!--
Codebase analysis is entirely optional and separate from this document:
  npm run solution -- --input <this file> --codebase <path-to-repo> --system-id <SYS-id>
adds independent, read-only repository evidence for one explicitly-named
system id (never inferred from a folder or package name). Add
--modernization-export generic-java-replatform only when you want
implementation-oriented review artifacts generated — it never runs
automatically.
-->
