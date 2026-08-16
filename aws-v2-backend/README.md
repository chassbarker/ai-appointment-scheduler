# AI Appointment Scheduler AWS Backend

This directory contains the AWS serverless backend for version 2 of the AI Appointment Scheduler.

## Current Checkpoint

The first scheduling API endpoint has been created and tested locally.

- AWS SAM application
- Node.js 22 Lambda runtime
- API Gateway route: `GET /appointments`
- Lambda function: `SchedulingFunction`
- Mocha and Chai unit testing
- Local SAM validation and build completed successfully

The endpoint currently returns an initial empty appointments collection:

```json
{
  "message": "Appointments retrieved successfully",
  "appointments": []
}
