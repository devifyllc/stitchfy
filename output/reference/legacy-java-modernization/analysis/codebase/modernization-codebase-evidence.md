# Modernization ↔ Codebase Evidence

_System: **SYS-001**, repository: **legacy-java-maven**_

> Stitchfy performed static, read-only analysis of selected repository files. It did not compile, execute, test, deploy, or externally validate the application, and it did not query vulnerability or lifecycle databases. Repository evidence does not select a modernization strategy.

## Profile Mapping

- Framework facts: FRAMEWORK-001, FRAMEWORK-002, FRAMEWORK-003, FRAMEWORK-004, FRAMEWORK-005, FRAMEWORK-006
- Runtime facts: RUNTIME-001, RUNTIME-002
- Dependency facts: CODEDEP-001, CODEDEP-002, CODEDEP-003, CODEDEP-004

## Analysis Findings

- Analysis finding: dependency version for com.example:internal-fixture-lib could not be resolved locally.

## Validation Requirements From Repository Evidence

- Verify preserved servlet behavior after runtime migration.

## Evidence Conflicts

None.
