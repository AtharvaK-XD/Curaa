-- Seed Data for Hospital Queue Navigator

-- 1. Insert Hospital
insert into hospitals (id, name, address)
values ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'City General Hospital', '100 Medical Plaza, Sector 4')
on conflict (id) do update set name = excluded.name, address = excluded.address;

-- 2. Insert Departments
insert into departments (id, hospital_id, name, floor, room_number, color_code, avg_service_time_minutes)
values 
  ('b0000000-0000-0000-0000-000000000001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Registration', 1, 'Counter 1', 'blue', 5),
  ('b0000000-0000-0000-0000-000000000002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Billing', 1, 'Counter 2', 'teal', 8),
  ('b0000000-0000-0000-0000-000000000003', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Lab', 2, 'Room 201', 'purple', 15),
  ('b0000000-0000-0000-0000-000000000004', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'OPD Room 12', 3, 'Room 305', 'emerald', 20),
  ('b0000000-0000-0000-0000-000000000005', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'Pharmacy', 1, 'Counter 3', 'rose', 10)
on conflict (id) do update set 
  name = excluded.name, 
  floor = excluded.floor, 
  room_number = excluded.room_number, 
  color_code = excluded.color_code, 
  avg_service_time_minutes = excluded.avg_service_time_minutes;

-- 3. Insert Staff
-- Static IDs for demo staff log-in
insert into staff (id, name, department_id, role, hospital_id)
values
  ('c0000000-0000-0000-0000-000000000001', 'Dr. Ramesh Kumar (OPD Room 12)', 'b0000000-0000-0000-0000-000000000004', 'staff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('c0000000-0000-0000-0000-000000000002', 'Asha Sharma (Registration)', 'b0000000-0000-0000-0000-000000000001', 'staff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('c0000000-0000-0000-0000-000000000003', 'Vikram Patel (Billing)', 'b0000000-0000-0000-0000-000000000002', 'staff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('c0000000-0000-0000-0000-000000000004', 'Dr. Sneha Patel (Lab)', 'b0000000-0000-0000-0000-000000000003', 'staff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('c0000000-0000-0000-0000-000000000005', 'Rajesh Gupta (Pharmacy)', 'b0000000-0000-0000-0000-000000000005', 'staff', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
  ('c0000000-0000-0000-0000-000000000009', 'System Admin', null, 'admin', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11')
on conflict (id) do update set 
  name = excluded.name, 
  department_id = excluded.department_id, 
  role = excluded.role;
