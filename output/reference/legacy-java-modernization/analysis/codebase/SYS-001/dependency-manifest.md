# Dependency Manifest

> Stitchfy performed static, read-only analysis of selected repository files. It did not compile, execute, test, deploy, or externally validate the application, and it did not query vulnerability or lifecycle databases.

_Scoped to system: **SYS-001**_

## Maven Dependencies

- org.springframework:spring-context:4.3.30.RELEASE
- org.hibernate:hibernate-core:5.2.18.Final
- javax.servlet:javax.servlet-api:3.1.0 (provided)
- com.example:internal-fixture-lib:unresolved

## npm Dependencies

None identified.

## Build Plugins

See `codebase-analysis.md` → Build Systems for plugin coordinates recorded per descriptor.

## Compiler / Runtime Settings

- java: 8 _(compiler-config)_
- application-server: WebSphere _(descriptor)_

## Modules / Workspaces

- order-portal (`pom.xml`)

## Unresolved Versions

- com.example:internal-fixture-lib

## Evidence

14 evidence reference(s)
