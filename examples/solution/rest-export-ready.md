# Project: Storefront Bridge Co

## Business
- **Business Name:** Storefront Bridge Co
- **Industry:** Retail software
- **Description:** A small company whose Storefront application submits customer orders to an External Order API for fulfillment.

## Goals
- Automate order submission to the fulfillment partner
- Avoid manual re-entry of order data

## Users
- Fulfillment Coordinator

## Business Processes

Order Submission

Trigger:
An order is confirmed in the Storefront application

Actors:
Fulfillment Coordinator

Current systems:
Storefront
External Order API

Steps:
1. Storefront confirms the order is ready for fulfillment
2. Storefront submits the order to the External Order API
3. Fulfillment Coordinator confirms the order was accepted

Pain points:
- Orders were previously re-entered by hand into the fulfillment partner's portal

Automation candidates:
- Automatic order submission to the External Order API

## Existing Systems
- Storefront
- External Order API

## Integrations
- Storefront submits the order to the External Order API.
  Integration method: REST over HTTPS
  Base URL: https://api.example.test
  Endpoint: POST /v1/orders
  Authentication: API key
  Authentication placement: X-API-Key request header
  Request fields: externalOrderId (string, required), amount (number, required)
  Response fields: orderId (string, required), status (string, required)

## Desired Outcomes
- Order submission to the External Order API happens automatically
- No manual re-entry of order data is required
