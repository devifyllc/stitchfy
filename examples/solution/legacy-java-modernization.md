# Project: Order Portal Modernization

## Business
- **Business Name:** Order Portal Modernization
- **Industry:** Retail software
- **Description:** An internal order-management application running on an aging application-server platform, integrated with a fulfillment routing gateway and its own order database.

## Goals
- Modernize the Order Portal without disrupting existing order operations

## Users
- Order Portal internal staff
- Fulfillment Coordinator

## Existing Systems
- **Order Portal:** Internal legacy order-management application.
- **Integration Gateway:** Routes order requests to external fulfillment systems.
- **Order Database:** Stores order and customer-order information.

## Integrations
- The Order Portal sends order requests to the Integration Gateway.
  Integration method: REST over HTTPS
- The Order Portal reads and writes order records in the Order Database.
  Integration method: JDBC

## Modernization Requirements
- The business wants to modernize the Order Portal.
- The application must move from IBM WebSphere to Apache Tomcat while preserving application behavior.
- Existing order-management business behavior must remain unchanged.
- Existing integration behavior with the Integration Gateway must remain compatible.
- The Order Database technology must not change during this modernization phase.
- The migration must allow the current and modernized application versions to coexist during validation.
- No cloud provider has been selected.
- No microservices decomposition has been approved.

## Modernization Drivers
- Reduce dependency on the existing application-server platform.
- Improve maintainability of the application runtime.
- Make future application upgrades easier.

## Migration Constraints
- Database technology must remain unchanged.
- Existing integration behavior must remain compatible.
- Production cutover approach has not been selected.

## Desired Outcomes
- The Order Portal runs on a supported, maintainable application-server platform
- Existing order operations continue without disruption during modernization
