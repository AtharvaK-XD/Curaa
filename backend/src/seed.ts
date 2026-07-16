import { supabase } from './db';

const HOSPITAL_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const DEPARTMENTS = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    hospital_id: HOSPITAL_ID,
    name: 'Registration',
    floor: 1,
    room_number: 'Counter 1',
    color_code: 'blue',
    avg_service_time_minutes: 5,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    hospital_id: HOSPITAL_ID,
    name: 'Billing',
    floor: 1,
    room_number: 'Counter 2',
    color_code: 'teal',
    avg_service_time_minutes: 8,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    hospital_id: HOSPITAL_ID,
    name: 'Lab',
    floor: 2,
    room_number: 'Room 201',
    color_code: 'purple',
    avg_service_time_minutes: 15,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000004',
    hospital_id: HOSPITAL_ID,
    name: 'OPD Room 12',
    floor: 3,
    room_number: 'Room 305',
    color_code: 'emerald',
    avg_service_time_minutes: 20,
    is_bottleneck: false
  },
  {
    id: 'b0000000-0000-0000-0000-000000000005',
    hospital_id: HOSPITAL_ID,
    name: 'Pharmacy',
    floor: 1,
    room_number: 'Counter 3',
    color_code: 'rose',
    avg_service_time_minutes: 10,
    is_bottleneck: false
  }
];

const STAFF = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    name: 'Dr. Ramesh Kumar (OPD Room 12)',
    department_id: 'b0000000-0000-0000-0000-000000000004',
    role: 'staff',
    hospital_id: HOSPITAL_ID
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    name: 'Asha Sharma (Registration)',
    department_id: 'b0000000-0000-0000-0000-000000000001',
    role: 'staff',
    hospital_id: HOSPITAL_ID
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    name: 'Vikram Patel (Billing)',
    department_id: 'b0000000-0000-0000-0000-000000000002',
    role: 'staff',
    hospital_id: HOSPITAL_ID
  },
  {
    id: 'c0000000-0000-0000-0000-000000000004',
    name: 'Dr. Sneha Patel (Lab)',
    department_id: 'b0000000-0000-0000-0000-000000000003',
    role: 'staff',
    hospital_id: HOSPITAL_ID
  },
  {
    id: 'c0000000-0000-0000-0000-000000000005',
    name: 'Rajesh Gupta (Pharmacy)',
    department_id: 'b0000000-0000-0000-0000-000000000005',
    role: 'staff',
    hospital_id: HOSPITAL_ID
  },
  {
    id: 'c0000000-0000-0000-0000-000000000009',
    name: 'System Admin',
    department_id: null,
    role: 'admin',
    hospital_id: HOSPITAL_ID
  }
];

async function runSeed() {
  console.log('Starting programmatic database seeding...');

  try {
    // 1. Seed Hospital
    const { error: hospError } = await supabase
      .from('hospitals')
      .upsert({ id: HOSPITAL_ID, name: 'City General Hospital', address: '100 Medical Plaza, Sector 4' });

    if (hospError) throw hospError;
    console.log('✔ Seeded Hospital: City General Hospital');

    // 2. Seed Departments
    const { error: deptError } = await supabase
      .from('departments')
      .upsert(DEPARTMENTS);

    if (deptError) throw deptError;
    console.log('✔ Seeded Departments (Registration, Billing, Lab, OPD Room 12, Pharmacy)');

    // 3. Seed Staff
    const { error: staffError } = await supabase
      .from('staff')
      .upsert(STAFF);

    if (staffError) throw staffError;
    console.log('✔ Seeded Staff records');

    console.log('🎉 Seeding completed successfully!');
  } catch (err: any) {
    console.error('❌ Seeding failed:', err.message || err);
  }
}

runSeed();
