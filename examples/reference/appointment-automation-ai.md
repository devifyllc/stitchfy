# Project: Riverside Wellness Studio

## Business
- **Business Name:** Riverside Wellness Studio
- **Industry:** Service business (appointments)
- **Description:** A small wellness studio that takes appointment requests by phone and WhatsApp, and wants a customer-facing AI assistant to answer routine questions and check availability without bypassing conflict review.

## Goals
- Let customers request appointments online at any time, not just during business hours
- Reduce the time front-desk staff spend answering routine questions
- Keep a human in the loop whenever a request conflicts with an existing booking

## Users
- Customers booking appointments
- Front-desk employee handling requests and reviewing conflicts

## Business Processes

Appointment Booking

Trigger:
Customer requests an appointment by phone, WhatsApp, or the AI assistant

Actors:
Customer
Front-desk employee

Current systems:
Google Calendar
WhatsApp

Steps:
1. Customer requests an appointment
2. The system checks Google Calendar for availability
3. If the request conflicts with an existing booking, a front-desk employee must review and approve or reject it before it is confirmed
4. Confirmed appointments are recorded and a reminder is sent before the appointment

Pain points:
- Appointments can only be handled during operating hours
- Manual calendar entry is error-prone
- Conflicting requests have occasionally been double-booked without review

Business rules:
- Appointments cannot overlap for the same employee
- A conflicting appointment request must always be approved by a front-desk employee before confirmation

Automation candidates:
- Online appointment requests
- Calendar synchronization
- Automated confirmations and reminders
- An AI assistant that answers routine questions and checks availability

## Existing Systems
- Google Calendar
- WhatsApp

## Data
- Customer name, phone number, and appointment history (personal customer information) collected during booking

## Integrations
- The booking system checks and reserves availability in Google Calendar.
  Integration method: REST over HTTPS
  Authentication: OAuth2

## Requirements
- Conflicting appointment requests must always be routed to a front-desk employee for approval before confirmation.
- Customer personal information must not appear in operational logs.
- Operations must be notified if automated confirmation or reminder delivery fails.
- Workflow, integration, and AI assistant activity must remain operationally visible.

## AI Agent Needs
- Customers should be able to ask the assistant questions about services and studio policies.
- The assistant may check appointment availability using the existing Google Calendar integration.
- The assistant must not confirm a conflicting appointment without front-desk employee approval — conflict approval can never be bypassed.
- The assistant may not cancel appointments autonomously.
- Conversation history is only needed during the active customer session and should not persist after the session ends.
- Model or provider has not been selected.
- When the assistant cannot confidently answer from known business information, escalate the conversation to a front-desk employee.

## Desired Outcomes
- Customers can request appointments and get routine questions answered at any time
- Every conflicting request is reviewed and approved by a front-desk employee before confirmation
- Workflow, integration, and AI assistant activity are all observable in operation
