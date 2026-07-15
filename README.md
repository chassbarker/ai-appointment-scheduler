# ai-appointment-scheduler
Full-stack appointment scheduling app using Supabase Authentication, PostgreSQL, HTML, CSS, and JavaScript. Includes CRUD appointments and an upcoming AI assistant.
# AI Appointment Scheduler

A portfolio project that demonstrates secure authentication and appointment management using Supabase, PostgreSQL, HTML, CSS, and JavaScript.

## Features

- Email and password account creation
- Secure login and logout with Supabase Auth
- Protected dashboard
- Create, view, edit, and delete appointments
- User-specific data access enforced with Row Level Security
- Responsive and accessible interface

## Technology

- Supabase Auth
- Supabase Data API
- PostgreSQL
- HTML5
- CSS3
- JavaScript

## Database

The `appointments` table uses these columns:

- `id` UUID primary key
- `user_id` UUID linked to the authenticated user
- `name` text
- `type` text
- `date` date
- `time` time
- `notes` text, nullable
- `created_at` timestamp

Row Level Security policies restrict SELECT, INSERT, UPDATE, and DELETE operations to rows where `user_id = auth.uid()`.

## Project background

This project expands on an appointment-scheduling chatbot created during an AWS Academy Amazon Lex lab. The Supabase version is an independently maintained full-stack portfolio project.
