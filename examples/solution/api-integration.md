# Project: Fulfillment Bridge Co

## Business
- **Business Name:** Fulfillment Bridge Co
- **Industry:** Logistics software
- **Description:** A small company whose Order Management application forwards orders to a third-party Fulfillment API for shipping.

## Goals
- Automate forwarding of ready orders for fulfillment
- Avoid manual re-entry of order data

## Users
- Fulfillment Coordinator

## Business Processes

Order Fulfillment Handoff

Trigger:
An order is marked ready for fulfillment in the Order Management application

Actors:
Fulfillment Coordinator

Current systems:
Order Management
Fulfillment API

Steps:
1. Order Management marks the order as ready for fulfillment
2. Order Management sends the order to the Fulfillment API
3. Fulfillment Coordinator confirms the order was accepted

Pain points:
- Orders were previously re-entered by hand into the fulfillment partner's portal

Automation candidates:
- Automatic order submission to the Fulfillment API

## Existing Systems
- Order Management
- Fulfillment API

## Integrations
- The Order Management application sends orders to the Fulfillment API.
  Integration method: REST over HTTPS
  Endpoint: POST /v1/orders
  Authentication: API key
  Expected response: Order identifier and accepted status

## Desired Outcomes
- Order submission to the Fulfillment API happens automatically
- No manual re-entry of order data is required
