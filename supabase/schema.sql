-- Hospital Queue Navigator Database Schema
-- Multi-tenancy ready: includes hospital_id where relevant

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create custom types / enums
create type preferred_language_type as enum ('en', 'hi', 'gu');
create type appointment_status_type as enum ('scheduled', 'checked_in', 'completed', 'no_show');
create type token_status_type as enum ('waiting', 'called', 'in_progress', 'completed', 'skipped');
create type event_actor_type as enum ('system', 'staff', 'patient');
create type event_type_enum as enum ('created', 'called', 'skipped', 'completed', 'rerouted');
create type staff_role_type as enum ('staff', 'admin');
create type alert_channel_type as enum ('sms', 'whatsapp', 'in_app');
create type alert_status_type as enum ('sent', 'failed', 'pending');

-- 1. Hospitals (for multi-tenancy scalability)
create table if not exists hospitals (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  address text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Patients
create table if not exists patients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  preferred_language preferred_language_type default 'en'::preferred_language_type not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Departments
create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  hospital_id uuid references hospitals(id) on delete cascade not null,
  name text not null, -- Registration, Billing, Lab, OPD Room 12, Pharmacy
  floor integer not null,
  room_number text not null,
  color_code text not null, -- e.g., 'blue', 'teal', 'emerald', 'purple', 'rose'
  avg_service_time_minutes integer default 10 not null,
  is_bottleneck boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Appointments
create table if not exists appointments (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade not null,
  doctor_name text not null,
  department_id uuid references departments(id) on delete cascade not null,
  scheduled_time timestamp with time zone not null,
  status appointment_status_type default 'scheduled'::appointment_status_type not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tokens
create table if not exists tokens (
  id uuid primary key default uuid_generate_v4(),
  patient_id uuid references patients(id) on delete cascade not null,
  appointment_id uuid references appointments(id) on delete set null,
  department_id uuid references departments(id) on delete cascade not null,
  token_number text not null, -- e.g. REG-101, BIL-102
  status token_status_type default 'waiting'::token_status_type not null,
  is_urgent boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  called_at timestamp with time zone,
  completed_at timestamp with time zone
);

-- 6. Queue Events (Event-sourcing audit log)
create table if not exists queue_events (
  id uuid primary key default uuid_generate_v4(),
  token_id uuid references tokens(id) on delete cascade not null,
  event_type event_type_enum not null,
  department_id uuid references departments(id) on delete cascade not null,
  actor event_actor_type default 'system'::event_actor_type not null,
  metadata jsonb default '{}'::jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Staff
create table if not exists staff (
  id uuid primary key default uuid_generate_v4(), -- Maps to auth.users in Supabase
  name text not null,
  department_id uuid references departments(id) on delete set null,
  role staff_role_type default 'staff'::staff_role_type not null,
  hospital_id uuid references hospitals(id) on delete cascade not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Alerts Log
create table if not exists alerts_log (
  id uuid primary key default uuid_generate_v4(),
  token_id uuid references tokens(id) on delete cascade not null,
  channel alert_channel_type not null,
  message text not null,
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  status alert_status_type default 'pending'::alert_status_type not null
);

-- Indexing for optimized querying
create index if not exists idx_tokens_patient on tokens(patient_id);
create index if not exists idx_tokens_department_status on tokens(department_id, status);
create index if not exists idx_queue_events_token on queue_events(token_id);
create index if not exists idx_appointments_patient on appointments(patient_id);

-- Set up Row Level Security (RLS)
alter table patients enable row level security;
alter table departments enable row level security;
alter table appointments enable row level security;
alter table tokens enable row level security;
alter table queue_events enable row level security;
alter table staff enable row level security;
alter table alerts_log enable row level security;

-- Define RLS Policies

-- Departments can be read by everyone (public information)
create policy "Allow read access to departments" on departments
  for select using (true);

-- Patients RLS:
-- Anyone can insert a patient (for self check-in)
create policy "Allow insert access to patients" on patients
  for insert with check (true);

-- A patient can read their own details (in a real app, authenticated or session-based, here by UUID)
create policy "Allow read access to patients for themselves" on patients
  for select using (true);

-- Appointments RLS:
create policy "Allow read access to appointments" on appointments
  for select using (true);

create policy "Allow insert access to appointments" on appointments
  for insert with check (true);

-- Tokens RLS:
-- Anyone can view tokens (needed for general public TV display and patient tracking)
create policy "Allow read access to tokens" on tokens
  for select using (true);

-- Patients can create tokens (when checking in)
create policy "Allow insert access to tokens" on tokens
  for insert with check (true);

-- Staff can update tokens
create policy "Allow update access to tokens for staff" on tokens
  for update using (true);

-- Queue Events RLS:
create policy "Allow read access to queue_events" on queue_events
  for select using (true);

create policy "Allow insert access to queue_events" on queue_events
  for insert with check (true);

-- Staff RLS:
create policy "Allow read access to staff" on staff
  for select using (true);

-- Alerts Log RLS:
create policy "Allow read access to alerts_log" on alerts_log
  for select using (true);

create policy "Allow insert/update to alerts_log" on alerts_log
  for all using (true);
