from flask import Blueprint, request, jsonify
import bcrypt
import jwt
import datetime
import random
import os
from bson import ObjectId
from functools import wraps
import resend

auth_bp = Blueprint('auth', __name__)

resend.api_key = os.getenv('RESEND_API_KEY', '')

SUPERUSER_EMAIL = 'dheer@kcl.ac.uk'


def get_db():
    from app import db
    return db


def get_secret():
    from app import app
    return app.config['SECRET_KEY']


def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not token:
            return jsonify({'message': 'Token required'}), 401
        try:
            payload = jwt.decode(token, get_secret(), algorithms=['HS256'])
            kwargs['current_user_id'] = payload['user_id']
            kwargs['current_user_role'] = payload.get('role', 'student')
            kwargs['current_user_email'] = payload.get('email', '')
        except jwt.ExpiredSignatureError:
            return jsonify({'message': 'Token expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'message': 'Invalid token'}), 401
        return f(*args, **kwargs)
    return decorated


def make_token(user):
    """Generate a JWT with user_id, role, and email in payload."""
    return jwt.encode(
        {
            'user_id': str(user['_id']),
            'role': user.get('role', 'student'),
            'email': user.get('email', ''),
            'exp': datetime.datetime.utcnow() + datetime.timedelta(days=7),
        },
        get_secret(), algorithm='HS256'
    )


def serialize_user(user):
    return {
        '_id': str(user['_id']),
        'email': user['email'],
        'name': user['name'],
        'card_uid': user.get('card_uid'),
        'role': user.get('role', 'student'),
        'university': user.get('university', ''),
        'created_at': user.get('created_at', datetime.datetime.utcnow()).isoformat(),
    }


def send_otp_email(email: str, otp: str, name: str):
    """Send OTP verification email via Resend."""
    resend.Emails.send({
        "from": "UniTap <noreply@londonrobotics.co.uk>",
        "to": [email],
        "subject": f"UniTap — Your verification code is {otp}",
        "html": f"""
        <div style="font-family: monospace; background: #0B0B0B; color: #f5f5f0; padding: 40px; max-width: 480px;">
            <div style="font-size: 24px; font-weight: 800; margin-bottom: 24px;">
                <span style="color: #FF5F1F;">■</span> UNITAP
            </div>
            <p style="color: #b0b0b0; font-size: 14px;">Hey {name},</p>
            <p style="color: #b0b0b0; font-size: 14px;">Your verification code is:</p>
            <div style="font-size: 36px; font-weight: 800; letter-spacing: 0.3em; color: #FF5F1F; margin: 24px 0; padding: 16px; background: #111111; border: 1px solid #222222; border-radius: 8px; text-align: center;">
                {otp}
            </div>
            <p style="color: #555555; font-size: 12px;">This code expires in 10 minutes.</p>
        </div>
        """,
    })


# ─── Registration (OTP flow) ────────────────────────

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    db = get_db()

    if db.users.find_one({'email': data['email']}):
        return jsonify({'message': 'Email already registered'}), 400

    password_hash = bcrypt.hashpw(
        data.get('password', 'default123').encode('utf-8'),
        bcrypt.gensalt()
    ).decode('utf-8')

    otp = str(random.randint(100000, 999999))

    db.pending_verifications.update_one(
        {'email': data['email']},
        {'$set': {
            'email': data['email'],
            'name': data['name'],
            'password_hash': password_hash,
            'university': data.get('university', ''),
            'otp': otp,
            'created_at': datetime.datetime.utcnow(),
        }},
        upsert=True,
    )

    try:
        send_otp_email(data['email'], otp, data['name'])
    except Exception as e:
        return jsonify({'message': f'Failed to send verification email: {str(e)}'}), 500

    return jsonify({'message': 'OTP sent', 'email': data['email']}), 200


@auth_bp.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    db = get_db()

    email = data.get('email')
    otp = data.get('otp')

    if not email or not otp:
        return jsonify({'message': 'email and otp required'}), 400

    pending = db.pending_verifications.find_one({'email': email})
    if not pending:
        return jsonify({'message': 'No pending verification found. Please register again.'}), 404

    elapsed = (datetime.datetime.utcnow() - pending['created_at']).total_seconds()
    if elapsed > 600:
        db.pending_verifications.delete_one({'_id': pending['_id']})
        return jsonify({'message': 'OTP expired. Please register again.'}), 400

    if pending['otp'] != otp:
        return jsonify({'message': 'Invalid OTP'}), 400

    user = {
        'email': pending['email'],
        'name': pending['name'],
        'password_hash': pending['password_hash'],
        'card_uid': None,
        'role': 'student',
        'university': pending.get('university', ''),
        'created_at': datetime.datetime.utcnow(),
    }

    result = db.users.insert_one(user)
    user['_id'] = result.inserted_id

    db.pending_verifications.delete_one({'_id': pending['_id']})

    return jsonify({'token': make_token(user), 'user': serialize_user(user)}), 201


@auth_bp.route('/resend-otp', methods=['POST'])
def resend_otp():
    data = request.get_json()
    db = get_db()

    email = data.get('email')
    if not email:
        return jsonify({'message': 'email required'}), 400

    pending = db.pending_verifications.find_one({'email': email})
    if not pending:
        return jsonify({'message': 'No pending verification found. Please register again.'}), 404

    otp = str(random.randint(100000, 999999))
    db.pending_verifications.update_one(
        {'_id': pending['_id']},
        {'$set': {'otp': otp, 'created_at': datetime.datetime.utcnow()}}
    )

    try:
        send_otp_email(email, otp, pending['name'])
    except Exception as e:
        return jsonify({'message': f'Failed to send verification email: {str(e)}'}), 500

    return jsonify({'message': 'OTP resent', 'email': email}), 200


# ─── Login ───────────────────────────────────────────

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    db = get_db()

    user = db.users.find_one({'email': data['email']})
    if not user:
        return jsonify({'message': 'Invalid credentials'}), 401

    if not bcrypt.checkpw(data['password'].encode('utf-8'), user['password_hash'].encode('utf-8')):
        return jsonify({'message': 'Invalid credentials'}), 401

    return jsonify({'token': make_token(user), 'user': serialize_user(user)})


# ─── Card Linking ────────────────────────────────────

def normalize_uid(raw_uid: str) -> str:
    """Normalize a card UID to uppercase hex without separators."""
    return raw_uid.replace(':', '').replace('-', '').replace(' ', '').upper()


@auth_bp.route('/link-card', methods=['POST'])
def link_card():
    data = request.get_json()
    db = get_db()

    user_id = data.get('user_id')
    card_uid = data.get('card_uid')

    if not user_id or not card_uid:
        return jsonify({'message': 'user_id and card_uid required'}), 400

    card_uid = normalize_uid(card_uid)

    existing = db.users.find_one({'card_uid': card_uid})
    if existing and str(existing['_id']) != user_id:
        return jsonify({'message': 'Card already linked to another account'}), 400

    result = db.users.update_one(
        {'_id': ObjectId(user_id)},
        {'$set': {'card_uid': card_uid}}
    )

    if result.matched_count == 0:
        return jsonify({'message': 'User not found'}), 404

    user = db.users.find_one({'_id': ObjectId(user_id)})
    return jsonify(serialize_user(user))


@auth_bp.route('/link-card-by-email', methods=['POST'])
def link_card_by_email():
    """Link a friend's card using their email (for iPhone users)."""
    data = request.get_json()
    db = get_db()

    email = data.get('email')
    card_uid = data.get('card_uid')

    if not email or not card_uid:
        return jsonify({'message': 'email and card_uid required'}), 400

    card_uid = normalize_uid(card_uid)

    user = db.users.find_one({'email': email})
    if not user:
        return jsonify({'message': 'No account found with that email. Ask your friend to register first.'}), 404

    existing = db.users.find_one({'card_uid': card_uid})
    if existing and existing['_id'] != user['_id']:
        return jsonify({'message': 'Card already linked to another account'}), 400

    db.users.update_one(
        {'_id': user['_id']},
        {'$set': {'card_uid': card_uid}}
    )

    return jsonify({'message': 'Card linked successfully', 'user_name': user['name']})


# ─── User Info ───────────────────────────────────────

@auth_bp.route('/me', methods=['GET'])
@token_required
def me(current_user_id=None, current_user_role=None, current_user_email=None):
    db = get_db()
    user = db.users.find_one({'_id': ObjectId(current_user_id)})
    if not user:
        return jsonify({'message': 'User not found'}), 404
    return jsonify(serialize_user(user))


@auth_bp.route('/me/attendance', methods=['GET'])
@token_required
def my_attendance(current_user_id=None, current_user_role=None, current_user_email=None):
    """Get the current user's personal attendance history."""
    db = get_db()
    user_oid = ObjectId(current_user_id)
    lectures = list(db.lectures.find({'attendees': user_oid}).sort('start_time', -1))

    result = []
    now = datetime.datetime.utcnow()
    for l in lectures:
        status = 'upcoming'
        if now >= l['end_time']:
            status = 'ended'
        elif now >= l['start_time']:
            status = 'live'

        result.append({
            '_id': str(l['_id']),
            'name': l['name'],
            'professor': l.get('professor', ''),
            'room': l.get('room', ''),
            'start_time': l['start_time'].isoformat(),
            'end_time': l['end_time'].isoformat(),
            'status': status,
        })

    return jsonify(result)


@auth_bp.route('/me/societies', methods=['GET'])
@token_required
def my_societies(current_user_id=None, current_user_role=None, current_user_email=None):
    """Get societies the current user is a member of, plus their events."""
    db = get_db()
    user_oid = ObjectId(current_user_id)

    socs = list(db.societies.find({'members': user_oid}))
    soc_ids = [s['_id'] for s in socs]

    events = list(db.events.find({'society_id': {'$in': soc_ids}}).sort('date', 1))

    soc_map = {str(s['_id']): s['name'] for s in socs}

    return jsonify({
        'societies': [{
            '_id': str(s['_id']),
            'name': s['name'],
            'description': s.get('description', ''),
            'members': [str(m) for m in s.get('members', [])],
            'admins': [str(a) for a in s.get('admins', [])],
        } for s in socs],
        'events': [{
            '_id': str(e['_id']),
            'society_id': str(e['society_id']),
            'society_name': soc_map.get(str(e['society_id']), ''),
            'name': e['name'],
            'date': e['date'].isoformat(),
            'location': e.get('location', ''),
            'registered': [str(r) for r in e.get('registered', [])],
            'checked_in': [str(c) for c in e.get('checked_in', [])],
        } for e in events],
    })


# ─── User Search (for society admin management) ─────

@auth_bp.route('/search', methods=['GET'])
@token_required
def search_users(current_user_id=None, current_user_role=None, current_user_email=None):
    """Search users by email (partial match). Any logged-in user can search."""
    q = request.args.get('q', '').strip()
    if len(q) < 2:
        return jsonify([])

    db = get_db()
    import re
    regex = re.compile(re.escape(q), re.IGNORECASE)
    users = list(db.users.find({'email': regex}, {'password_hash': 0}).limit(10))
    return jsonify([serialize_user(u) for u in users])


# ─── Superuser: User Management ─────────────────────

@auth_bp.route('/users', methods=['GET'])
@token_required
def list_users(current_user_id=None, current_user_role=None, current_user_email=None):
    """List all users (superuser only)."""
    if current_user_email != SUPERUSER_EMAIL:
        return jsonify({'message': 'Forbidden'}), 403

    db = get_db()
    users = list(db.users.find({}, {'password_hash': 0}))
    return jsonify([serialize_user(u) for u in users])


@auth_bp.route('/promote', methods=['POST'])
@token_required
def promote_user(current_user_id=None, current_user_role=None, current_user_email=None):
    """Change a user's role (superuser only)."""
    if current_user_email != SUPERUSER_EMAIL:
        return jsonify({'message': 'Forbidden'}), 403

    data = request.get_json()
    target_id = data.get('target_user_id')
    new_role = data.get('new_role')

    if not target_id or not new_role:
        return jsonify({'message': 'target_user_id and new_role required'}), 400

    valid_roles = ['student', 'professor', 'society_admin', 'class_admin', 'superuser']
    if new_role not in valid_roles:
        return jsonify({'message': f'Invalid role. Must be one of: {valid_roles}'}), 400

    db = get_db()
    result = db.users.update_one(
        {'_id': ObjectId(target_id)},
        {'$set': {'role': new_role}}
    )

    if result.matched_count == 0:
        return jsonify({'message': 'User not found'}), 404

    user = db.users.find_one({'_id': ObjectId(target_id)})
    return jsonify(serialize_user(user))
