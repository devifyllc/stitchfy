# Project: Community Care Studio

## Business
- **Business Name:** Community Care Studio
- **Industry:** Personal services
- **Description:** A small studio that takes appointment and contact information from customers online.

## Goals
- Keep customer records visible only to authorized employees
- Ensure cancellations above a stated threshold are reviewed by a manager

## Users
- Employee
- Manager

## Business Processes

Appointment Request Review

Trigger:
A customer submits contact and appointment information

Actors:
Employee
Manager

Steps:
1. Employee signs in before reviewing appointment requests
2. Employee reviews the submitted customer information
3. Manager approves cancellations above the stated threshold
4. Approval actions are recorded

Business rules:
- Employees must sign in before reviewing customer requests
- Only managers may approve cancellations above the stated threshold
- Customer records must not be visible to unauthorized employees
- Approval actions must be recorded

## Existing Systems
- Online request form

## Data
- Customer contact and appointment information

## Constraints
- The exact authentication provider has not been selected

## Desired Outcomes
- Only authorized employees can view customer records
- Cancellations above the threshold are reviewed by a manager
- Approval actions are auditable
