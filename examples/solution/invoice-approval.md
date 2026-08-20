# Project: Ledger Services Co

## Business
- **Business Name:** Ledger Services Co
- **Industry:** Professional services (accounting)
- **Description:** A small services firm that receives supplier invoices by email and processes them for payment.

## Goals
- Reduce manual invoice data entry
- Ensure large invoices always get manager review
- Keep accounting informed without manual follow-up

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
5. Accounting is notified that the invoice was processed

Pain points:
- Manual data entry is slow and error-prone
- Manager review is inconsistent for borderline amounts

Business rules:
- Invoices of $1,000 or more require Finance Manager approval before payment

Automation candidates:
- Automatic invoice data extraction
- Automatic routing for manager approval above the threshold
- Automatic notification to accounting once processed

## Pain Points
- Manual data entry is slow and error-prone
- Invoices can be paid before manager review in rare cases

## Existing Systems
- Email
- QuickBooks

## Integrations
- QuickBooks sync

## Desired Outcomes
- Invoice data entry is automated
- Invoices above the threshold always require Finance Manager approval before payment
- Accounting is automatically notified once an invoice is processed
