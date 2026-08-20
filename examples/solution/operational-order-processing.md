# Project: Northwind Order Systems

## Business
- **Business Name:** Northwind Order Systems
- **Industry:** Retail software
- **Description:** A small company whose Order Management application forwards approved orders to a third-party Fulfillment API for shipping.

## Goals
- Reliably forward approved orders to the fulfillment partner
- Detect and respond to fulfillment submission problems quickly

## Users
- Fulfillment Coordinator

## Business Processes

Order Fulfillment Handoff

Trigger:
An order is approved and ready for fulfillment in the Order Management application

Actors:
Fulfillment Coordinator

Current systems:
Order Management
Fulfillment API

Steps:
1. Order Management marks the order as ready for fulfillment
2. Order Management sends the order to the Fulfillment API
3. Fulfillment Coordinator confirms the order was accepted

## Existing Systems
- Order Management
- Fulfillment API

## Data
- Customer payment and order details

## Integrations
- The Order Management application sends orders to the Fulfillment API.
  Integration method: REST over HTTPS
  Endpoint: POST /v1/orders
  Authentication: API key

## Requirements
- Every order submission must have a correlation identifier.
- Failed order submissions must be recorded.
- Operations must be notified after 5 consecutive failed submissions.
- 95% of accepted order submissions should complete within 2 seconds.
- API keys and customer order payloads must not appear in operational logs.
- Order-processing audit trails must be retained.

## Desired Outcomes
- Order submission problems are detected and addressed quickly
- Fulfillment partner integration remains observable in production
