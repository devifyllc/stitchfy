# Project: Northwind Order Platform

## Business
- **Business Name:** Northwind Order Platform
- **Industry:** Retail software
- **Description:** A small company operating a solution-managed Order API and background Order Processor that forwards approved orders to a third-party Fulfillment API for shipping.

## Goals
- Reliably process and forward customer orders to the fulfillment partner
- Detect and respond to fulfillment submission problems quickly
- Keep the platform available to customers even when the fulfillment partner has temporary problems

## Users
- Customers placing orders
- Fulfillment Coordinator

## Business Processes

Order Submission

Trigger:
A customer submits an order through the Order API

Actors:
Customer
Fulfillment Coordinator

Current systems:
Fulfillment API

Steps:
1. Customer submits an order through the Order API
2. The Order Processor validates the order and forwards it to the Fulfillment API
3. Fulfillment Coordinator confirms the order was accepted

## Existing Systems
- Fulfillment API

## Integrations
- The Order Processor submits orders to the Fulfillment API.
  Integration method: REST over HTTPS
  Base URL: https://api.fulfillment.example.test
  Endpoint: POST /v1/orders
  Authentication: API key
  Authentication placement: X-API-Key request header
  Request fields: orderId (string, required), customerId (string, required), amount (number, required), items (array, required)
  Response fields: fulfillmentId (string, required), status (string, required)

## Deployment Requirements
- The solution includes a solution-managed Order API that receives customer order requests.
- The Order API must be publicly reachable over HTTPS.
- The solution includes a solution-managed Order Processor that processes accepted orders in the background.
- The Order Processor must not expose a public endpoint.
- The business requires separate Test and Production environments.
- Order processing state must persist and survive application restarts.
- Production must support at least 100 concurrent order submissions.
- The solution must continue accepting new orders when the external Fulfillment API is temporarily unavailable.
- No cloud provider has been selected.
- No database technology has been selected.

## Requirements
- Every order submission must have a correlation identifier.
- Failed order submissions must be recorded.
- Operations must be notified after 5 consecutive failed fulfillment submissions.
- 95% of accepted order submissions should complete within 2 seconds.
- API keys and customer order payloads must not appear in operational logs.
- Order-processing audit trails must be retained.

## Desired Outcomes
- Order submission problems are detected and addressed quickly
- The platform remains available to customers during fulfillment partner outages
- Fulfillment partner integration remains observable in production
