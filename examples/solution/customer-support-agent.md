# Project: Bright Smile Dental Care

## Business
- **Business Name:** Bright Smile Dental Care
- **Industry:** Service business (appointments)
- **Description:** A small dental practice. The business wants an AI customer assistant to answer routine questions and check appointment availability.

## Goals
- Reduce time employees spend answering routine questions
- Let customers check appointment availability outside business hours

## Users
- Customers requesting appointments
- Front-desk employee

## Business Processes

Appointment Booking

Trigger:
Customer contacts the business to request an appointment

Actors:
Customer
Front-desk employee

Current systems:
Google Calendar

Steps:
1. Customer contacts the business
2. Employee checks Google Calendar for availability
3. Employee manually confirms availability with the customer
4. Employee records customer information

Business rules:
- Appointments cannot overlap for the same employee

Automation candidates:
- Automated availability check

## Existing Systems
- Google Calendar

## Integrations
- Google Calendar sync

## AI Agent Needs
- Customers should be able to ask questions about services and business policies.
- The assistant may summarize a customer's request for the front-desk employee.
- The assistant may check appointment availability using the existing scheduling integration.
- The assistant must not confirm a conflicting appointment without employee approval.
- The assistant may not cancel appointments autonomously.
- Conversation history is only needed during the active customer session.
- Conversation history should not persist after the session.
- Model or provider has not been selected.
- When the assistant cannot confidently answer from known business information, route the request to an employee.

## Desired Outcomes
- Customers can ask questions about services and policies at any time
- An employee approves any request that conflicts with existing bookings
