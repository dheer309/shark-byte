from flask import Blueprint, request, jsonify
from bson import ObjectId
import datetime

societies_bp = Blueprint('societies', __name__)

SUPERUSER_EMAIL = 'dheer@kcl.ac.uk'


def get_db():
    from app import db
    return db


def serialize_society(soc, db=None):
    admin_ids = soc.get('admins', [])
    admin_details = []
    if db is not None and admin_ids:
        admin_users = {str(u['_id']): u for u in db.users.find(
            {'_id': {'$in': admin_ids}}, {'name': 1, 'email': 1}
        )}
        for a in admin_ids:
            u = admin_users.get(str(a))
            admin_details.append({
                '_id': str(a),
                'name': u['name'] if u else 'Unknown',
                'email': u['email'] if u else '',
            })
    else:
        admin_details = [{'_id': str(a), 'name': '', 'email': ''} for a in admin_ids]

    return {
        '_id': str(soc['_id']),
        'name': soc['name'],
        'lead_id': str(soc['lead_id']) if soc.get('lead_id') else None,
        'admins': [str(a) for a in admin_ids],
        'admin_details': admin_details,
        'members': [str(m) for m in soc.get('members', [])],
        'description': soc.get('description', ''),
    }


def serialize_event(event, society_name=None):
    return {
        '_id': str(event['_id']),
        'society_id': str(event['society_id']),
        'society_name': society_name or '',
        'name': event['name'],
        'description': event.get('description', ''),
        'location': event.get('location', ''),
        'date': event['date'].isoformat() if hasattr(event['date'], 'isoformat') else event['date'],
        'capacity': event.get('capacity', 0),
        'registered': [str(r) for r in event.get('registered', [])],
        'checked_in': [str(c) for c in event.get('checked_in', [])],
        'device_id': event.get('device_id'),
    }


def _can_manage_society(db, society_id, user_id, user_role, user_email):
    """Check if user can manage a society (create events, add admins, etc.)."""
    if user_email == SUPERUSER_EMAIL:
        return True
    if user_role == 'class_admin':
        return True
    society = db.societies.find_one({'_id': ObjectId(society_id)})
    if not society:
        return False
    return ObjectId(user_id) in society.get('admins', [])


# ─── Societies ───────────────────────────────────────

@societies_bp.route('', methods=['GET'])
def get_all():
    db = get_db()
    societies = list(db.societies.find())
    return jsonify([serialize_society(s, db) for s in societies])


@societies_bp.route('', methods=['POST'])
def create_society():
    """Create a new society. Only superuser or class_admin can create societies."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    # Only admins can create societies
    if payload.get('email') != SUPERUSER_EMAIL and payload.get('role') not in ('class_admin',):
        return jsonify({'message': 'Only admins can create societies'}), 403

    user_id = payload['user_id']
    data = request.get_json()
    db = get_db()

    # Check if society with same name already exists
    if db.societies.find_one({'name': data['name']}):
        return jsonify({'message': 'A society with that name already exists'}), 400

    society = {
        'name': data['name'],
        'description': data.get('description', ''),
        'lead_id': ObjectId(user_id),
        'admins': [ObjectId(user_id)],
        'members': [ObjectId(user_id)],
    }

    result = db.societies.insert_one(society)
    society['_id'] = result.inserted_id

    return jsonify(serialize_society(society, db)), 201


# ─── Society Admin Management ────────────────────────

@societies_bp.route('/<society_id>/admins', methods=['POST'])
def add_admin(society_id):
    """Add a user as admin of a society. Accepts email or user_id."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    if not _can_manage_society(db, society_id, payload['user_id'], payload.get('role', 'student'), payload.get('email', '')):
        return jsonify({'message': 'Forbidden'}), 403

    data = request.get_json()

    # Look up target user by email or user_id
    if 'email' in data:
        target_user = db.users.find_one({'email': data['email']})
        if not target_user:
            return jsonify({'message': f'No user found with email {data["email"]}'}), 404
        target_id = target_user['_id']
    elif 'user_id' in data:
        target_id = ObjectId(data['user_id'])
    else:
        return jsonify({'message': 'email or user_id required'}), 400

    db.societies.update_one(
        {'_id': ObjectId(society_id)},
        {'$addToSet': {'admins': target_id, 'members': target_id}}
    )

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    return jsonify(serialize_society(society, db))


@societies_bp.route('/<society_id>/admins/<user_id>', methods=['DELETE'])
def remove_admin(society_id, user_id):
    """Remove a user as admin of a society (keeps them as member)."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    if not _can_manage_society(db, society_id, payload['user_id'], payload.get('role', 'student'), payload.get('email', '')):
        return jsonify({'message': 'Forbidden'}), 403

    # Prevent removing the last admin (the president)
    society = db.societies.find_one({'_id': ObjectId(society_id)})
    if society and len(society.get('admins', [])) <= 1:
        return jsonify({'message': 'Cannot remove the last admin'}), 400

    db.societies.update_one(
        {'_id': ObjectId(society_id)},
        {'$pull': {'admins': ObjectId(user_id)}}
    )

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    return jsonify(serialize_society(society, db))


@societies_bp.route('/<society_id>/transfer', methods=['POST'])
def transfer_presidency(society_id):
    """Transfer presidency to another admin. Only current president or superuser."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    society = db.societies.find_one({'_id': ObjectId(society_id)})
    if not society:
        return jsonify({'message': 'Society not found'}), 404

    user_id = payload['user_id']
    user_email = payload.get('email', '')
    is_president = str(society.get('lead_id')) == user_id
    is_super = user_email == SUPERUSER_EMAIL

    if not is_president and not is_super:
        return jsonify({'message': 'Only the president or superuser can transfer presidency'}), 403

    data = request.get_json()
    new_lead_id = ObjectId(data['user_id'])

    # New president must already be an admin
    if new_lead_id not in society.get('admins', []):
        return jsonify({'message': 'New president must be an existing admin'}), 400

    db.societies.update_one(
        {'_id': ObjectId(society_id)},
        {'$set': {'lead_id': new_lead_id}}
    )

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    return jsonify(serialize_society(society, db))


# ─── Events ─────────────────────────────────────────

@societies_bp.route('/events', methods=['GET'])
def get_events():
    db = get_db()
    society_id = request.args.get('society_id')

    query = {}
    if society_id:
        query['society_id'] = ObjectId(society_id)

    events = list(db.events.find(query).sort('date', 1))

    soc_ids = list(set(e['society_id'] for e in events))
    societies = {str(s['_id']): s['name'] for s in db.societies.find({'_id': {'$in': soc_ids}})}

    return jsonify([
        serialize_event(e, societies.get(str(e['society_id']), ''))
        for e in events
    ])


def _get_auth_payload():
    """Extract JWT payload from request, returns None if invalid."""
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    import jwt as pyjwt
    from app import app
    try:
        return pyjwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except Exception:
        return None


@societies_bp.route('/events', methods=['POST'])
def create_event():
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    data = request.get_json()
    db = get_db()

    if not _can_manage_society(db, data['society_id'], payload['user_id'], payload.get('role', 'student'), payload.get('email', '')):
        return jsonify({'message': 'Forbidden'}), 403

    location = data.get('location', '')
    # Auto-resolve device_id from the location so NFC taps route correctly
    device_at_loc = db.devices.find_one({'location': location}) if location else None
    resolved_device_id = device_at_loc['device_id'] if device_at_loc else data.get('device_id')

    event = {
        'society_id': ObjectId(data['society_id']),
        'name': data['name'],
        'description': data.get('description', ''),
        'location': location,
        'date': datetime.datetime.fromisoformat(data['date']),
        'capacity': data.get('capacity', 0),
        'registered': [],
        'checked_in': [],
        'device_id': resolved_device_id,
    }

    result = db.events.insert_one(event)
    event['_id'] = result.inserted_id

    society = db.societies.find_one({'_id': event['society_id']})
    soc_name = society['name'] if society else ''

    return jsonify(serialize_event(event, soc_name)), 201


@societies_bp.route('/events/<event_id>', methods=['PUT'])
def update_event(event_id):
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    event = db.events.find_one({'_id': ObjectId(event_id)})
    if not event:
        return jsonify({'message': 'Event not found'}), 404

    if not _can_manage_society(db, str(event['society_id']), payload['user_id'], payload.get('role', 'student'), payload.get('email', '')):
        return jsonify({'message': 'Forbidden'}), 403

    data = request.get_json()
    update = {}
    for field in ['name', 'description', 'capacity']:
        if field in data:
            update[field] = data[field]
    if 'date' in data:
        update['date'] = datetime.datetime.fromisoformat(data['date'])
    if 'location' in data:
        update['location'] = data['location']
        # Re-resolve device_id whenever location changes
        device_at_loc = db.devices.find_one({'location': data['location']}) if data['location'] else None
        update['device_id'] = device_at_loc['device_id'] if device_at_loc else None

    if update:
        db.events.update_one({'_id': ObjectId(event_id)}, {'$set': update})

    event = db.events.find_one({'_id': ObjectId(event_id)})
    society = db.societies.find_one({'_id': event['society_id']})
    return jsonify(serialize_event(event, society['name'] if society else ''))


@societies_bp.route('/events/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    event = db.events.find_one({'_id': ObjectId(event_id)})
    if not event:
        return jsonify({'message': 'Event not found'}), 404

    if not _can_manage_society(db, str(event['society_id']), payload['user_id'], payload.get('role', 'student'), payload.get('email', '')):
        return jsonify({'message': 'Forbidden'}), 403

    db.events.delete_one({'_id': ObjectId(event_id)})
    return jsonify({'message': 'Event deleted'}), 200


@societies_bp.route('/<society_id>/leave', methods=['POST'])
def leave_society(society_id):
    """Leave a society as a member."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    user_id = ObjectId(payload['user_id'])
    db = get_db()

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    if not society:
        return jsonify({'message': 'Society not found'}), 404

    # Prevent the president from leaving
    if society.get('lead_id') == user_id:
        return jsonify({'message': 'President cannot leave — transfer presidency first'}), 400

    db.societies.update_one(
        {'_id': ObjectId(society_id)},
        {'$pull': {'members': user_id, 'admins': user_id}}
    )

    return jsonify({'message': 'Left society'})


@societies_bp.route('/<society_id>/join', methods=['POST'])
def join_society(society_id):
    """Join a society as a member."""
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    user_id = ObjectId(payload['user_id'])
    db = get_db()

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    if not society:
        return jsonify({'message': 'Society not found'}), 404

    db.societies.update_one(
        {'_id': ObjectId(society_id)},
        {'$addToSet': {'members': user_id}}
    )

    society = db.societies.find_one({'_id': ObjectId(society_id)})
    return jsonify(serialize_society(society, db))


@societies_bp.route('/events/<event_id>/register', methods=['DELETE'])
def unregister_from_event(event_id):
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    event = db.events.find_one({'_id': ObjectId(event_id)})
    if not event:
        return jsonify({'message': 'Event not found'}), 404

    user_id = ObjectId(payload['user_id'])
    db.events.update_one(
        {'_id': ObjectId(event_id)},
        {'$pull': {'registered': user_id}}
    )

    event = db.events.find_one({'_id': ObjectId(event_id)})
    society = db.societies.find_one({'_id': event['society_id']})
    return jsonify(serialize_event(event, society['name'] if society else ''))


@societies_bp.route('/events/<event_id>/register', methods=['POST'])
def register_for_event(event_id):
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    db = get_db()
    event = db.events.find_one({'_id': ObjectId(event_id)})
    if not event:
        return jsonify({'message': 'Event not found'}), 404

    # Capacity check
    capacity = event.get('capacity', 0)
    registered = event.get('registered', [])
    if capacity > 0 and len(registered) >= capacity:
        return jsonify({'message': 'Event is full'}), 400

    user_id = ObjectId(payload['user_id'])
    db.events.update_one(
        {'_id': ObjectId(event_id)},
        {'$addToSet': {'registered': user_id}}
    )

    event = db.events.find_one({'_id': ObjectId(event_id)})
    society = db.societies.find_one({'_id': event['society_id']})
    soc_name = society['name'] if society else ''

    return jsonify(serialize_event(event, soc_name))
