# Project: Northwind Order Platform

## Business
- **Business Name:** Northwind Order Platform
- **Industry:** Retail software
- **Description:** A small company whose order platform forwards approved orders to a third-party Fulfillment API for shipping.

## Goals
- Reliably process customer orders
- Detect and respond to fulfillment submission problems quickly

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
2. Order Processor validates and forwards the order to the Fulfillment API
3. Fulfillment Coordinator confirms the order was accepted

## Existing Systems
- Fulfillment API

## Integrations
- The Order Processor sends orders to the Fulfillment API.
  Integration method: REST over HTTPS
  Endpoint: POST /v1/orders
  Authentication: API key

## Deployment Requirements
- The solution includes a solution-managed Order API that receives customer order requests.
- The Order API must be publicly reachable over HTTPS.
- The solution includes a solution-managed Order Processor that processes accepted orders in the background.
- The Order Processor must not expose a public endpoint.
- The business requires separate Test and Production environments.
- Order processing state must survive application restarts.
- The solution must continue accepting new orders when the external Fulfillment API is temporarily unavailable.
- Production must support at least 100 concurrent order submissions.
- No cloud provider has been selected.
- No database technology has been selected.
- No deployment strategy has been selected.

## Desired Outcomes
- Order submission problems are detected and addressed quickly
- The platform remains available to customers
