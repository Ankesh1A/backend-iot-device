const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const Device = require('./src/models/Device');
const Location = require('./src/models/Location');
const User = require('./src/models/User');

const connectDB = require('./src/config/db');

const DEMO_DEVICES = [
    {
        device_id: 'GPS-001',
        device_name: 'Truck A-1',
        imei: '862093012345678',
        mobile_num: '+91 9876543210',
        vehicle_id: 'MH-12-AB-1234',
        status: 'Active',
        plan_validity: new Date('2026-12-31'),
        battery: 85,
        signal: 'Strong',
        speed: 45,
        lat: 23.2599,
        lng: 77.4126,
        address: 'Bhopal Junction',
        distance_today: 127,
    },
    {
        device_id: 'GPS-002',
        device_name: 'Delivery Van 03',
        imei: '862093012345679',
        mobile_num: '+91 9123456789',
        vehicle_id: 'MH-12-XY-5678',
        status: 'Inactive',
        plan_validity: new Date('2025-06-15'),
        battery: 23,
        signal: 'Weak',
        speed: 0,
        lat: 23.2800,
        lng: 77.4300,
        address: 'MP Nagar',
        distance_today: 42,
    },
    {
        device_id: 'GPS-003',
        device_name: 'Project Car',
        imei: '862093012345610',
        mobile_num: '+91 9988776655',
        vehicle_id: 'MH-01-XX-9999',
        status: 'Active',
        plan_validity: new Date('2026-01-01'),
        battery: 61,
        signal: 'Good',
        speed: 32,
        lat: 23.2400,
        lng: 77.4000,
        address: 'Arera Colony',
        distance_today: 88,
    },
    {
        device_id: 'GPS-004',
        device_name: 'Cargo Truck 02',
        imei: '862093012345611',
        mobile_num: '+91 9876001234',
        vehicle_id: 'MH-14-CD-7890',
        status: 'Active',
        plan_validity: new Date('2027-03-15'),
        battery: 92,
        signal: 'Strong',
        speed: 67,
        lat: 23.2300,
        lng: 77.3900,
        address: 'Karond Square',
        distance_today: 203,
    },
];

const LOCATION_HISTORY = [
    { lat: 23.2200, lng: 77.3800, speed: 0, address: 'Depot, Bhopal' },
    { lat: 23.2350, lng: 77.3950, speed: 52, address: 'Karond Square' },
    { lat: 23.2500, lng: 77.4050, speed: 40, address: 'Shyamla Hills' },
    { lat: 23.2599, lng: 77.4126, speed: 45, address: 'Bhopal Junction' },
    { lat: 23.2650, lng: 77.4200, speed: 60, address: 'Arera Colony' },
    { lat: 23.2700, lng: 77.4300, speed: 30, address: 'MP Nagar' },
    { lat: 23.2780, lng: 77.4450, speed: 55, address: 'Hoshangabad Road' },
    { lat: 23.2820, lng: 77.4600, speed: 20, address: 'Mandideep Entry' },
];

const seedDB = async () => {
    await connectDB();

    console.log('🌱 Seeding database...');

    // Clear existing data
    await Device.deleteMany();
    await Location.deleteMany();
    await User.deleteMany();
    console.log('🗑️  Cleared existing data');

    // Create admin user
    const admin = await User.create({
        name: 'Admin User',
        email: 'admin@gps-track.io',
        password: 'admin123',
        role: 'admin',
    });
    console.log(`👤 Admin created: ${admin.email} / admin123`);

    // Create devices
    const devices = await Device.insertMany(DEMO_DEVICES);
    console.log(`🚛 Created ${devices.length} demo devices`);

    // Create location history for first device
    const firstDevice = devices[0];
    const now = new Date('2024-02-24T08:00:00');
    const locationDocs = LOCATION_HISTORY.map((loc, i) => ({
        device: firstDevice._id,
        device_id: firstDevice.device_id,
        lat: loc.lat,
        lng: loc.lng,
        speed: loc.speed,
        address: loc.address,
        battery: 85,
        signal: 'Strong',
        time: new Date(now.getTime() + i * 30 * 60000), // 30 min intervals
    }));
    await Location.insertMany(locationDocs);
    console.log(`📍 Created ${locationDocs.length} location history records`);

    console.log('\n Seeding complete!');
    console.log('─────────────────────────────');
    console.log('Login: admin@gps-track.io / admin123');
    console.log('─────────────────────────────\n');
    process.exit(0);
};

seedDB().catch(err => {
    console.error('Seed error:', err);
    process.exit(1);
});
