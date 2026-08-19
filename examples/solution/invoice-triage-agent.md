# Project: Clearwater Bookkeeping

## Business
- **Business Name:** Clearwater Bookkeeping
- **Industry:** Professional services (accounting)
- **Description:** A small bookkeeping firm that receives supplier invoices by email and processes them for payment.

## Goals
- Reduce time spent manually reviewing incoming invoices
- Ensure large invoices always get manager review

## Users
- Accounts Payable Clerk
- Finance Manager

## Business Processes

Invoice Processing

Trigger:
A supplier invoice is received by email

Actors:
Accounts Payable Clerk
Finance Manager

Current systems:
Email
QuickBooks

Steps:
1. Clerk receives the supplier invoice by email
2. Clerk manually enters invoice data into QuickBooks
3. Finance Manager reviews invoices above $1,000
4. Approved invoice is recorded as payable

Business rules:
- Invoices of $1,000 or more require Finance Manager approval before payment

Automation candidates:
- Automatic invoice data extraction

## Existing Systems
- Email
- QuickBooks

## Integrations
- QuickBooks sync

## AI Agent Needs
- The assistant summarizes invoice text already extracted by the existing accounting system.
- The assistant classifies each invoice into an existing spending category.
- The assistant highlights missing information on the invoice.
- The assistant does not approve the invoice.
- The assistant does not make payment.
- The assistant does not change accounting records.
- Finance Manager retains authority to approve invoices.
- No long-term AI memory is required.
- Model or provider has not been selected.

## Desired Outcomes
- Invoice review preparation is faster for the Accounts Payable Clerk
- Invoices above the threshold always require Finance Manager approval before payment
