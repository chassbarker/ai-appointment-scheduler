# AI Appointment Scheduler

A browser-based appointment scheduler built with Supabase Authentication, PostgreSQL, HTML, CSS, and JavaScript.

## Features

- Email/password signup, login, and logout
- Protected dashboard
- Create, view, edit, and delete appointments
- Chronological date and time sorting
- User-specific access enforced with PostgreSQL Row Level Security
- Responsive and accessible interface
- Safe DOM rendering for user-entered appointment details

## Setup

1. Create a Supabase project.
2. Open **SQL Editor** in Supabase and run `supabase.sql`.
3. In **Authentication > URL Configuration**, add your deployed site URL and any local URL you use.
4. If you use a different Supabase project, replace `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` at the top of `js/auth.js`.
5. Serve the folder through a local web server. For example, run `python -m http.server 8000` in the project folder and open `http://localhost:8000`.

The browser key is a Supabase publishable key, not a service-role secret. Database protection depends on the included RLS policies. Never place a service-role key in frontend code.

## Project structure

```text
css/style.css          Shared responsive styling
js/auth.js             Supabase client and authentication
js/appointments.js     Appointment CRUD and safe rendering
index.html             Landing page
login.html             Login and signup page
dashboard.html         Protected appointment dashboard
supabase.sql           Table, policies, and index
```

## Database

The `appointments` table contains `id`, `user_id`, `name`, `type`, `date`, `time`, `notes`, and `created_at`. RLS restricts every operation to rows whose `user_id` matches `auth.uid()`.

## License

MIT
