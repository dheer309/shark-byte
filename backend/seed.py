"""Seed the MongoDB database with demo data for UniTap."""

import datetime
import bcrypt
from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017')
db = client['unitap']

# Clear existing data
for col in ['users', 'devices', 'lectures', 'equipment', 'societies', 'events', 'tap_events', 'pending_verifications']:
    db[col].drop()

print('Cleared existing data.')

# ─── Users ───────────────────────────────────────────
def hash_pw(pw):
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

users_data = [
    {'email': 'dheer@kcl.ac.uk', 'name': 'Dheer Maheshwari', 'password_hash': hash_pw('demo123'), 'card_uid': 'A1B2C3D4', 'role': 'superuser', 'university': 'KCL'},
    {'email': 'alice@kcl.ac.uk', 'name': 'Alice Chen', 'password_hash': hash_pw('demo123'), 'card_uid': 'E5F6G7H8', 'role': 'student', 'university': 'KCL'},
    {'email': 'bob@kcl.ac.uk', 'name': 'Bob Williams', 'password_hash': hash_pw('demo123'), 'card_uid': 'I9J0K1L2', 'role': 'student', 'university': 'KCL'},
    {'email': 'carol@kcl.ac.uk', 'name': 'Carol Davis', 'password_hash': hash_pw('demo123'), 'card_uid': 'M3N4O5P6', 'role': 'student', 'university': 'KCL'},
    {'email': 'david@kcl.ac.uk', 'name': 'David Park', 'password_hash': hash_pw('demo123'), 'card_uid': 'Q7R8S9T0', 'role': 'student', 'university': 'KCL'},
    {'email': 'emma@kcl.ac.uk', 'name': 'Emma Wilson', 'password_hash': hash_pw('demo123'), 'card_uid': 'U1V2W3X4', 'role': 'student', 'university': 'KCL'},
    {'email': 'frank@kcl.ac.uk', 'name': 'Frank Zhang', 'password_hash': hash_pw('demo123'), 'card_uid': 'Y5Z6A7B8', 'role': 'student', 'university': 'KCL'},
    {'email': 'dr.smith@kcl.ac.uk', 'name': 'Dr. Sarah Smith', 'password_hash': hash_pw('demo123'), 'card_uid': 'PROF0001', 'role': 'professor', 'university': 'KCL'},
]

for u in users_data:
    u['created_at'] = datetime.datetime.utcnow()

user_ids = db.users.insert_many(users_data).inserted_ids
print(f'Inserted {len(user_ids)} users.')

# Map for easy reference
users = {u['name']: u for u in db.users.find()}

# ─── Devices ─────────────────────────────────────────
now = datetime.datetime.utcnow()
today = now.replace(hour=0, minute=0, second=0, microsecond=0)

devices_data = [
    {'device_id': 'UNITAP-001', 'name': 'Bush House Door', 'location': 'Bush House 1.01', 'mode': 'attendance', 'config': {}, 'is_online': True, 'last_seen': now},
    {'device_id': 'UNITAP-002', 'name': 'Strand Lecture Hall', 'location': 'Strand Building S1.27', 'mode': 'attendance', 'config': {}, 'is_online': True, 'last_seen': now},
    {'device_id': 'UNITAP-003', 'name': 'Maker Space Entry', 'location': 'Maker Space', 'mode': 'equipment', 'config': {}, 'is_online': True, 'last_seen': now},
    {'device_id': 'UNITAP-004', 'name': 'Lab Equipment Desk', 'location': 'Engineering Lab 2.04', 'mode': 'equipment', 'config': {}, 'is_online': True, 'last_seen': now},
    {'device_id': 'UNITAP-005', 'name': 'Great Hall Entrance', 'location': 'Great Hall', 'mode': 'event', 'config': {}, 'is_online': True, 'last_seen': now},
    {'device_id': 'UNITAP-006', 'name': 'SU Lounge', 'location': 'Student Union Lounge', 'mode': 'event', 'config': {}, 'is_online': False, 'last_seen': now - datetime.timedelta(hours=2)},
]

db.devices.insert_many(devices_data)
print(f'Inserted {len(devices_data)} devices.')

# ─── Lectures ────────────────────────────────────────
lectures_data = [
    {
        'name': 'Database Systems',
        'professor': 'Dr. Sarah Smith',
        'room': 'Bush House 1.01',
        'start_time': today.replace(hour=9),
        'end_time': today.replace(hour=10),
        'device_id': 'UNITAP-001',
        'expected_students': 165,
        # Attendees populated from seeded tap_events below (Alice, Bob, Carol)
        'attendees': [users['Alice Chen']['_id'], users['Bob Williams']['_id'], users['Carol Davis']['_id']],
    },
    {
        'name': 'Machine Learning',
        'professor': 'Dr. Sarah Smith',
        'room': 'Strand Building S1.27',
        'start_time': today.replace(hour=11),
        'end_time': today.replace(hour=12, minute=30),
        'device_id': 'UNITAP-002',
        'expected_students': 120,
        # Attendees populated from seeded tap_events below (Dheer only)
        'attendees': [users['Dheer Maheshwari']['_id']],
    },
    {
        'name': 'Computer Networks',
        'professor': 'Prof. James Taylor',
        'room': 'Bush House 1.01',
        'start_time': today.replace(hour=14),
        'end_time': today.replace(hour=15, minute=30),
        'device_id': 'UNITAP-001',
        'expected_students': 90,
        'attendees': [],
    },
    {
        'name': 'Software Engineering',
        'professor': 'Dr. Lisa Park',
        'room': 'Strand Building S1.27',
        'start_time': today.replace(hour=16),
        'end_time': today.replace(hour=17, minute=30),
        'device_id': 'UNITAP-002',
        'expected_students': 145,
        'attendees': [],
    },
]

lecture_ids = db.lectures.insert_many(lectures_data).inserted_ids
print(f'Inserted {len(lecture_ids)} lectures.')

# Update device configs to point to lectures
db.devices.update_one({'device_id': 'UNITAP-001'}, {'$set': {'config': {'lecture_id': str(lecture_ids[0])}}})
db.devices.update_one({'device_id': 'UNITAP-002'}, {'$set': {'config': {'lecture_id': str(lecture_ids[1])}}})

# ─── Equipment ───────────────────────────────────────
equipment_data = [
    {
        'name': '3D Printer #1',
        'location': 'Maker Space',
        'device_id': 'UNITAP-003',
        'status': 'in-use',
        'current_user_id': users['Alice Chen']['_id'],
        'queue': [users['Bob Williams']['_id']],
        'checkout_time': now - datetime.timedelta(hours=1),
    },
    {
        'name': 'Oscilloscope',
        'location': 'Engineering Lab 2.04',
        'device_id': 'UNITAP-004',
        'status': 'available',
        'current_user_id': None,
        'queue': [],
        'checkout_time': None,
    },
    {
        'name': 'Soldering Station #3',
        'location': 'Maker Space',
        'device_id': 'UNITAP-003',
        'status': 'in-use',
        'current_user_id': users['David Park']['_id'],
        'queue': [],
        'checkout_time': now - datetime.timedelta(minutes=30),
    },
    {
        'name': 'Logic Analyzer',
        'location': 'Engineering Lab 2.04',
        'device_id': 'UNITAP-004',
        'status': 'available',
        'current_user_id': None,
        'queue': [],
        'checkout_time': None,
    },
    {
        'name': 'Laser Cutter',
        'location': 'Maker Space',
        'device_id': 'UNITAP-003',
        'status': 'maintenance',
        'current_user_id': None,
        'queue': [users['Carol Davis']['_id'], users['Frank Zhang']['_id']],
        'checkout_time': None,
    },
]

db.equipment.insert_many(equipment_data)
print(f'Inserted {len(equipment_data)} equipment items.')

# ─── Societies ───────────────────────────────────────
societies_data = [
    {
        'name': 'KCL Tech',
        'lead_id': users['Emma Wilson']['_id'],
        'admins': [users['Emma Wilson']['_id']],
        'members': [users['Dheer Maheshwari']['_id'], users['Alice Chen']['_id'], users['Bob Williams']['_id'], users['Emma Wilson']['_id'], users['Frank Zhang']['_id']],
        'description': 'King\'s College London Technology Society',
    },
    {
        'name': 'AI Society',
        'lead_id': users['Alice Chen']['_id'],
        'admins': [users['Alice Chen']['_id']],
        'members': [users['Alice Chen']['_id'], users['Carol Davis']['_id'], users['David Park']['_id']],
        'description': 'Exploring artificial intelligence and machine learning',
    },
    {
        'name': 'Robotics Club',
        'lead_id': users['David Park']['_id'],
        'admins': [users['David Park']['_id']],
        'members': [users['David Park']['_id'], users['Frank Zhang']['_id'], users['Bob Williams']['_id']],
        'description': 'Building and programming robots',
    },
    {
        'name': 'Cyber Security Society',
        'lead_id': users['Frank Zhang']['_id'],
        'admins': [users['Frank Zhang']['_id']],
        'members': [users['Frank Zhang']['_id'], users['Dheer Maheshwari']['_id'], users['Emma Wilson']['_id'], users['Carol Davis']['_id']],
        'description': 'Ethical hacking, CTFs, and security research',
    },
]

society_ids = db.societies.insert_many(societies_data).inserted_ids
print(f'Inserted {len(society_ids)} societies.')

# ─── Events ─────────────────────────────────────────
events_data = [
    {
        'society_id': society_ids[0],  # KCL Tech
        'name': 'Intro to Rust Workshop',
        'description': 'Learn the basics of Rust programming language',
        'location': 'Bush House LT1',
        'date': today + datetime.timedelta(days=2, hours=18),
        'capacity': 80,
        'registered': [users['Dheer Maheshwari']['_id'], users['Alice Chen']['_id'], users['Bob Williams']['_id'], users['Frank Zhang']['_id']],
        'checked_in': [],
        'device_id': 'UNITAP-005',
    },
    {
        'society_id': society_ids[1],  # AI Society
        'name': 'GPT Paper Reading Group',
        'description': 'Discussing the latest LLM research papers',
        'location': 'Strand Building S1.27',
        'date': today + datetime.timedelta(days=1, hours=17),
        'capacity': 40,
        'registered': [users['Alice Chen']['_id'], users['Carol Davis']['_id']],
        'checked_in': [],
        'device_id': 'UNITAP-005',
    },
    {
        'society_id': society_ids[2],  # Robotics
        'name': 'Arduino Hackathon',
        'description': 'Build something cool with Arduino in 6 hours',
        'location': 'Maker Space',
        'date': today + datetime.timedelta(days=5, hours=10),
        'capacity': 30,
        'registered': [users['David Park']['_id'], users['Frank Zhang']['_id'], users['Bob Williams']['_id']],
        'checked_in': [],
        'device_id': 'UNITAP-006',
    },
    {
        'society_id': society_ids[3],  # Cyber Sec
        'name': 'CTF Night',
        'description': 'Capture the flag competition for all skill levels',
        'location': 'Great Hall',
        'date': today + datetime.timedelta(days=3, hours=19),
        'capacity': 100,
        'registered': [users['Frank Zhang']['_id'], users['Dheer Maheshwari']['_id'], users['Emma Wilson']['_id'], users['Carol Davis']['_id'], users['Alice Chen']['_id']],
        'checked_in': [],
        'device_id': 'UNITAP-005',
    },
]

db.events.insert_many(events_data)
print(f'Inserted {len(events_data)} events.')

# Update event device configs
event_ids = list(db.events.find({}, {'_id': 1}))
db.devices.update_one({'device_id': 'UNITAP-005'}, {'$set': {'config': {'event_id': str(event_ids[0]['_id'])}}})

# ─── Sample Tap Events ──────────────────────────────
tap_events_data = [
    {'user_id': users['Alice Chen']['_id'], 'user_name': 'Alice Chen', 'device_id': 'UNITAP-001', 'action': 'attendance', 'context': 'Database Systems — Bush House 1.01', 'timestamp': today.replace(hour=8, minute=55)},
    {'user_id': users['Bob Williams']['_id'], 'user_name': 'Bob Williams', 'device_id': 'UNITAP-001', 'action': 'attendance', 'context': 'Database Systems — Bush House 1.01', 'timestamp': today.replace(hour=8, minute=58)},
    {'user_id': users['Carol Davis']['_id'], 'user_name': 'Carol Davis', 'device_id': 'UNITAP-001', 'action': 'attendance', 'context': 'Database Systems — Bush House 1.01', 'timestamp': today.replace(hour=9, minute=2)},
    {'user_id': users['Alice Chen']['_id'], 'user_name': 'Alice Chen', 'device_id': 'UNITAP-003', 'action': 'equipment_checkout', 'context': '3D Printer #1 — Maker Space', 'timestamp': today.replace(hour=10, minute=15)},
    {'user_id': users['David Park']['_id'], 'user_name': 'David Park', 'device_id': 'UNITAP-003', 'action': 'equipment_checkout', 'context': 'Soldering Station #3 — Maker Space', 'timestamp': today.replace(hour=10, minute=30)},
    {'user_id': users['Dheer Maheshwari']['_id'], 'user_name': 'Dheer Maheshwari', 'device_id': 'UNITAP-002', 'action': 'attendance', 'context': 'Machine Learning — Strand Building S1.27', 'timestamp': today.replace(hour=10, minute=58)},
]

db.tap_events.insert_many(tap_events_data)
print(f'Inserted {len(tap_events_data)} tap events.')

# Create indexes
db.users.create_index('email', unique=True)
db.users.create_index('card_uid')
db.devices.create_index('device_id', unique=True)
db.tap_events.create_index('timestamp')
db.tap_events.create_index('user_id')

print('\nDone! Database seeded successfully.')
print(f'\nDemo credentials:')
print(f'  Email: dheer@kcl.ac.uk')
print(f'  Password: demo123')
print(f'  Card UID: A1B2C3D4')
