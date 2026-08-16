# AI Appointment Scheduler

[![Automated Tests](https://github.com/chassbarker/ai-appointment-scheduler/actions/workflows/tests.yml/badge.svg)](https://github.com/chassbarker/ai-appointment-scheduler/actions/workflows/tests.yml)

A responsive appointment-management application that combines a browser-based frontend, Supabase authentication and PostgreSQL, and an AWS serverless scheduling layer.

**Live demo:** [View the AI Appointment Scheduler](https://chassbarker.github.io/ai-appointment-scheduler/)

![AI Appointment Scheduler dashboard](images/ai-appointment-scheduler-dashboard.png)

## Project status

Version 2 expands the original Supabase appointment scheduler with AWS serverless infrastructure. The GitHub Pages frontend can send scheduling requests to an Amazon API Gateway HTTP API backed by AWS Lambda while the existing authenticated appointment workflow continues to use Supabase.

The project demonstrates frontend development, secure authentication, relational database design, serverless AWS integration, Infrastructure as Code with Terraform, automated testing, accessibility, and Git/GitHub workflows.

## Features

- Full-name account creation, email/password login, logout, and password recovery
- Protected dashboard and personalized welcome message
- Conversational assistant for booking, rescheduling, and cancelling appointments
- AWS API Gateway and Lambda integration for scheduling requests
- Provider-aware scheduling with multiple-provider support
- Weekly provider hours, lunch closures, time off, and time-zone configuration
- Appointment durations with database-enforced overlap prevention
- Two-hour advance notice and a 90-day booking window
- Cancellation history with completed, cancelled, and no-show statuses
- Multi-field appointment extraction with one-at-a-time follow-up prompts
- Explicit appointment selection and confirmation before changes
- Create, view, edit, complete, and delete appointments
- Appointment type and 12-hour time selectors
- Search and appointment-type filtering
- Separate upcoming and past/completed appointment sections
- Past-date and past-time validation
- User-specific access enforced with PostgreSQL Row Level Security
- Responsive, keyboard-accessible interface
- Accessible conversation log, focus management, and live loading/error status
- Safe DOM rendering for user-entered details
- Custom GitHub Pages 404 page
- Automated tests and GitHub Actions continuous integration

## Technology

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- GitHub Pages

### Backend and data

- Supabase Authentication
- Supabase Data API
- PostgreSQL
- PostgreSQL Row Level Security

### AWS and Infrastructure as Code

- Amazon API Gateway HTTP API
- AWS Lambda
- AWS IAM
- Amazon CloudWatch Logs
- Terraform
- AWS SAM

### Development and testing

- Node.js
- Node.js test runner
- Mocha and Chai for the AWS SAM backend test
- Git and GitHub
- GitHub Actions

## Architecture

```text
User Browser
    |
    v
GitHub Pages Frontend
    |
    | scheduling request
    v
Amazon API Gateway HTTP API
    |
    | POST /schedule
    v
AWS Lambda Scheduling Assistant
    |
    | validated response
    v
Frontend Conversation Flow
    |
    v
Supabase Authentication + PostgreSQL
    |
    v
User Appointment Data protected by RLS
```

The protected dashboard loads `js/scheduling-assistant.js` after the authentication and appointment modules. Scheduling messages are sent to an Amazon API Gateway HTTP endpoint backed by an AWS Lambda function. The Lambda function validates and acknowledges the scheduling request, and the existing deterministic client-side flow continues the booking, rescheduling, or cancellation process through Supabase.

This design allowed the original application to remain functional while adding a real AWS serverless layer as part of V2.

## AWS V2 architecture

### API Gateway

Terraform provisions an Amazon API Gateway v2 HTTP API with a `POST /schedule` route. The route uses an AWS proxy integration to invoke the scheduling Lambda function.

The API includes CORS configuration so the GitHub Pages frontend can communicate with the AWS endpoint.

### AWS Lambda

The scheduling assistant Lambda is implemented with Node.js 22 and ARM64 architecture. It receives scheduling requests from API Gateway and returns the service response to the frontend.

The Lambda source is located in:

```text
aws/lambda/scheduling-assistant/
```

### IAM and logging

Terraform provisions a dedicated Lambda execution role and attaches the AWS-managed basic execution policy required for CloudWatch logging.

A CloudWatch log group is also managed by Terraform with a 14-day retention period.

### Terraform

The production-style AWS infrastructure is defined in:

```text
infrastructure/terraform/
```

Terraform manages:

- Lambda packaging and deployment configuration
- Lambda execution role
- IAM policy attachment
- CloudWatch log group
- API Gateway HTTP API
- Lambda proxy integration
- `POST /schedule` route
- Default auto-deploy API stage
- API throttling settings
- Lambda permission for API Gateway invocation

The Terraform configuration is separated into provider, variable, output, version, and main infrastructure files so the environment can be reproduced consistently.

## Scheduling assistant flow

### Booking

The assistant recognizes booking intent and extracts an allowed appointment type, date, and time. It can identify multiple values from one message and asks for one missing value at a time. An appointment is inserted only after the user confirms the booking.

### Rescheduling and cancellation

Rescheduling and cancellation requests query the authenticated user's upcoming appointments and display an explicit appointment-selection list. The assistant does not infer which appointment to change from descriptive text alone.

Rescheduling validates the replacement date and time before requesting confirmation. Cancellation also requires confirmation before an appointment is removed.

### Data protection

Every select, insert, update, and delete operation uses the current Supabase session and includes a `user_id` restriction. PostgreSQL Row Level Security provides the final authorization boundary.

Conversation content is rendered with DOM text nodes and `textContent`. User-entered content is never inserted with `innerHTML`.

## Security

This project uses a Supabase publishable key in the browser, as intended for public frontend applications. PostgreSQL Row Level Security policies restrict appointment operations to the authenticated user's own records.

The scheduling database contains `providers`, `provider_availability`, `provider_time_off`, and `appointments`.

The `appointments` table contains:

- `id`
- `user_id`
- `provider_id`
- `name`
- `type`
- `date`
- `time`
- `duration_minutes`
- `notes`
- `status`
- `cancelled_at`
- `completed_at`
- `no_show_at`
- `created_at`
- `updated_at`

Every database operation is restricted to rows whose `user_id` matches `auth.uid()`.

No service-role keys, database passwords, or private API keys are included in the frontend.

## Testing

GitHub Actions automatically runs the appointment-management and scheduling-assistant tests for pull requests targeting `main` and changes pushed to `main`.

Run the frontend application tests from the project directory:

```powershell
node --test tests/appointments.test.cjs tests/scheduling-assistant.test.cjs
```

The AWS Lambda scheduling assistant also includes its own test file in the Lambda source directory.

Testing has covered:

- Account registration and login
- Appointment creation, editing, completion, and deletion
- User-data isolation
- Conversational booking
- Rescheduling and cancellation
- Date and time validation
- Appointment selection and confirmation
- AWS scheduling request handling
- API integration behavior
- Error and loading states

### Manual testing checklist

- Create and confirm an account
- Log in, log out, and reset a password
- Create, edit, complete, and delete an appointment
- Ask the assistant to book with all fields in one message
- Ask the assistant to book with fields in separate messages
- Verify the assistant asks for only one missing field at a time
- Try an unsupported appointment type
- Try an impossible date, past date or time, and malformed time
- Verify the assistant summarizes booking details before saving
- Decline a booking and confirm that no appointment is inserted
- Start rescheduling and verify upcoming appointments are displayed
- Verify an appointment is not inferred from typed descriptive text
- Select an appointment, enter a new date and time, and confirm or decline the change
- Start cancellation, select an appointment, and confirm or decline cancellation
- Test assistant loading and Supabase error states
- Verify search and appointment-type filters
- Verify past appointments move to the history section
- Test two accounts to confirm user-data isolation
- Test keyboard navigation and mobile layouts

## Accessibility

The interface is designed toward WCAG 2.2 Level AA and includes:

- Semantic landmarks
- Skip links
- Visible keyboard focus
- Associated form instructions
- Live status announcements
- Touch-friendly controls
- Reduced-motion support
- Forced-color support
- Responsive reflow

This statement describes the project's accessibility target and is not a guarantee of legal compliance. Automated testing should be supplemented with keyboard, zoom, contrast, and screen-reader testing.

## Setup

### Supabase

1. Create a Supabase project.
2. Run `supabase.sql` in the Supabase SQL Editor to create the database structure.
3. If the table already exists without completion status, run `migration-add-status.sql` once.
4. For an existing project, run `migration-prevent-scheduling-conflicts.sql` once to add providers, availability, durations, status history, and overlap protection.
5. In **Authentication > URL Configuration**, add the deployed website and password-reset URLs.
6. Replace the project URL and publishable key at the top of `js/auth.js` if using a different Supabase project.

### Frontend

Serve the project through a local web server or deploy it with GitHub Pages.

### AWS development prerequisites

- AWS CLI
- AWS SAM CLI
- Terraform
- Node.js
- Git

### Terraform configuration

Terraform files are located in:

```text
infrastructure/terraform/
```

Use `terraform.tfvars.example` as the starting point for environment-specific configuration. Do not commit credentials or private secrets.

Typical Terraform workflow:

```powershell
terraform init
terraform fmt -check
terraform validate
terraform plan
terraform apply
```

## Project structure

```text
.github/workflows/                     GitHub Actions workflows
aws/lambda/scheduling-assistant/       AWS Lambda scheduling assistant
aws-v2-backend/                        AWS SAM backend implementation
css/style.css                          Shared responsive styling
images/                                Project screenshots and images
infrastructure/terraform/              Terraform AWS infrastructure
js/auth.js                             Authentication and password recovery
js/providers.js                        Active-provider loading and selection
js/appointments.js                     CRUD, filters, validation, and safe rendering
js/scheduling-assistant.js             Conversational scheduling state machine
tests/appointments.test.cjs            Appointment interaction tests
tests/scheduling-assistant.test.cjs    Scheduling assistant interaction tests
index.html                             Landing page
login.html                             Login and account creation
reset-password.html                    Password reset page
dashboard.html                         Protected appointment dashboard
404.html                               Custom GitHub Pages error page
supabase.sql                           Complete database schema and RLS setup
migration-add-status.sql               Status update for existing databases
migration-prevent-scheduling-conflicts.sql
                                       Provider availability and conflict migration
```

## V2 progress

Version 1 was preserved with the `v1.0.0` release tag before V2 development began.

V2 work includes:

- AWS serverless scheduling backend
- API Gateway integration
- AWS Lambda scheduling assistant
- Terraform Infrastructure as Code
- IAM and CloudWatch configuration
- Frontend-to-AWS scheduling requests
- Automated Lambda tests
- Existing frontend and scheduling tests
- GitHub Actions continuous integration
- Updated AWS architecture documentation

## Future improvements

- Connect the assistant to an AI language model
- Add a staff dashboard for provider management and no-show actions
- Generate selectable appointment slots before confirmation
- Send appointment reminders
- Add calendar integration
- Create administrative scheduling tools
- Add more automated accessibility testing
- Expand automated browser and mobile testing

## Important notice

This application is a portfolio demonstration. It is not intended to collect or store real patient information, medical records, or protected health information.

## Connect

- **Portfolio:** [chassidybarker.com](https://chassidybarker.com)
- **LinkedIn:** [Chassidy Barker](https://www.linkedin.com/in/chassidy-barker-02478535a)
- **GitHub:** [chassbarker](https://github.com/chassbarker)

## License

This project is licensed under the MIT License.
