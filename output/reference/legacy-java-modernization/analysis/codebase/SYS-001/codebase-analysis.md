# Codebase Analysis

_Status: **complete**_

> Stitchfy performed static, read-only analysis of selected repository files. It did not compile, execute, test, deploy, or externally validate the application, and it did not query vulnerability or lifecycle databases.

## Repository Summary

- Name: legacy-java-maven
- Detected languages: Java
- Build descriptors: pom.xml
- Modules: 1
- Files analyzed: 5, ignored: 2
- Analyzers used: java-source, maven, repository

## Build Systems

- **BUILDSYS-001** _(maven)_ — com.example:order-portal:1.0.0 (war)

## Modules

- **MODULE-001** — order-portal (`pom.xml`)

## Runtime / Language Facts

- **RUNTIME-001** _(java, compiler-config)_ — project compiler source level: 8
- **RUNTIME-002** _(application-server, descriptor)_ — WebSphere

## Direct Dependencies

- **CODEDEP-001** _(maven)_ — org.springframework:spring-context@4.3.30.RELEASE
- **CODEDEP-002** _(maven)_ — org.hibernate:hibernate-core@5.2.18.Final
- **CODEDEP-003** _(maven)_ — javax.servlet:javax.servlet-api@3.1.0
- **CODEDEP-004** _(maven)_ — com.example:internal-fixture-lib@unresolved

## Framework Inventory

- **FRAMEWORK-001** — Spring Framework 4.3.30.RELEASE _(dependency)_
- **FRAMEWORK-002** — Hibernate 5.2.18.Final _(dependency)_
- **FRAMEWORK-003** — Servlet API (javax) 3.1.0 _(dependency)_
- **FRAMEWORK-004** — JPA (javax) _(import)_
- **FRAMEWORK-005** — Servlet API (javax) _(import)_
- **FRAMEWORK-006** — Spring Framework _(import)_

## Source Structure

- **SOURCE-001** — class OrderRepository (package com.example; implements java.io.Serializable) [@Entity]
- **SOURCE-002** — class OrderService (package com.example) [@Service]

## Configuration Inventory

- `src/main/resources/application.properties` _(spring-properties)_ — present

## Unresolved Facts

- **CODEDEP-004** — com.example:internal-fixture-lib version could not be resolved locally

## Analysis Limitations

None.

## Evidence

14 evidence reference(s)
