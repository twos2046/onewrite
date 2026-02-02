/*
  Add email column for email-based auth.
*/

alter table public.users
  add column if not exists email text;

create unique index if not exists users_email_unique
  on public.users (lower(email))
  where email is not null;
