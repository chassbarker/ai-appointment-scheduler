# AI Appointment Scheduler

A responsive appointment-management application built with Supabase Authentication, PostgreSQL, HTML, CSS, and JavaScript.

**Live demo:** https://chassbarker.github.io/ai-appointment-scheduler/

![AI Appointment Scheduler dashboard](images/ai-appointment-scheduler-dashboard.png)

## Features
- Full-name account creation, email/password login, logout, and password recovery
- Protected dashboard and personalized welcome message
- Conversational assistant for booking, rescheduling, and cancellation
- Multi-field appointment extraction with one-at-a-time follow-up prompts
- Explicit appointment selection and confirmation before changes
- Create, view, edit, complete, and delete appointments
- Appointment type and 12-hour time selectors
- Search and appointment-type filtering
- Separate upcoming and past/completed sections
- Past-date and past-time validation
- User-specific access enforced with PostgreSQL Row Level Security
- Responsive, keyboard-accessible interface
- Accessible conversation log, focus management, and live loading/error status
- Safe DOM rendering for user-entered details
- Custom GitHub Pages 404 page

## Technology

- Supabase Authentication and Data API
- PostgreSQL with Row Level Security
- HTML5, CSS3, and vanilla JavaScript
- GitHub Pages

## Scheduling assistant architecture

The protected dashboard loads `js/scheduling-assistant.js` after the existing authentication and appointment modules. The assistant uses a deterministic client-side conversation state machine; it does not call an external AI service and requires no private API key.

- Booking recognizes appointment intent, extracts an allowed type, date, and time (including multiple values in one message), asks for one missing value at a time, and inserts only after an explicit yes.
- Rescheduling and cancellation query the authenticated user's upcoming appointments, render an explicit selection list, and never infer a target from descriptive text.
- Rescheduling validates the replacement date and time before requesting confirmation. Cancellation requests confirmation before deletion.
- Every select, insert, update, and delete uses the current Supabase session and a `user_id` restriction. Existing PostgreSQL Row Level Security remains the final authorization boundary.
- Conversation content is rendered with DOM text nodes and `textContent`; user content is never inserted with `innerHTML`.

## Setup

1. Create a Supabase project.
2. Run `supabase.sql` in the Supabase SQL Editor for a new database.
3. If the table already exists without completion status, run `migration-add-status.sql` once.
4. In **Authentication > URL Configuration**, add the deployed site and reset-password URLs.
5. Replace the project URL and publishable key at the top of `js/auth.js` if using another Supabase project.
6. Serve the folder with a web server or deploy it through GitHub Pages.

## Security

This project uses a Supabase publishable key in the browser, as intended for public frontend applications. PostgreSQL Row Level Security policies restrict all appointment operations to the authenticated user's own records.

The `appointments` table contains `id`, `user_id`, `name`, `type`, `date`, `time`, `notes`, `status`, and `created_at`. Every database operation is restricted to rows whose `user_id` matches `auth.uid()`.

No service-role keys, database passwords, or private API keys are included in the frontend.

## Project structure

```text
css/style.css              Shared responsive styling
js/auth.js                 Authentication and password recovery
js/appointments.js         CRUD, filters, validation, and safe rendering
js/scheduling-assistant.js Conversational scheduling state machine and Supabase operations
tests/scheduling-assistant.test.cjs Dependency-free assistant interaction tests
tests/appointments.test.cjs           Dependency-free manual appointment interaction tests
index.html                 Landing page
login.html                 Login and account creation
reset-password.html        Password reset page
dashboard.html             Protected appointment dashboard
404.html                   GitHub Pages error page
supabase.sql               Complete schema and RLS setup
migration-add-status.sql   Completion-status update for existing projects
```

## Testing checklist

- Run `node tests/scheduling-assistant.test.cjs`
- Run `node tests/appointments.test.cjs`
- Create and confirm an account
- Log in, log out, and reset a password
- Create, edit, complete, and delete an appointment
- Ask the assistant to book with all fields in one message (for example, `Book dental tomorrow at 3 PM`)
- Ask the assistant to book with fields in separate messages; verify it asks for only one missing field at a time
- Try an unsupported appointment type, impossible date, past date/time, and malformed time
- Verify the assistant summarizes the three booking fields and does not insert before a yes response
- Decline a booking and verify no row is inserted
- Start rescheduling; verify upcoming appointments are displayed and no appointment is inferred from typed descriptive text
- Select an appointment, provide a new date and time, decline once, then confirm and verify only that row changes
- Start cancellation; select an appointment, decline once, then confirm and verify deletion occurs only after yes
- Test assistant loading and Supabase error states
- Verify search and type filters
- Verify past appointments move to the history section
- Test two accounts to confirm data isolation
- Test keyboard navigation and mobile layout
  
## Testing notes

The application has been tested with multiple user accounts to verify account registration, login, appointment creation, editing, completion, deletion, and user-data isolation.

Testing identified and resolved an issue that prevented appointments from saving when the optional Notes field was blank. Additional browser, mobile, keyboard, and screen-reader testing is recommended as development continues.
## Accessibility

The interface is designed toward WCAG 2.2 Level AA and includes semantic landmarks, skip links, visible keyboard focus, associated form instructions, live status announcements, touch-friendly controls, reduced-motion support, forced-color support, and responsive reflow. This statement describes the project target and is not a guarantee of legal compliance. Automated testing should be supplemented with keyboard, zoom, contrast, and screen-reader testing.

## Setup notes for the assistant

No additional environment variables or database migration are required. The assistant reuses the Supabase URL and publishable key from `js/auth.js`, the authenticated dashboard session, and the existing `appointments` table. Keep service-role keys and other private credentials out of all browser files.

## License

MIT
