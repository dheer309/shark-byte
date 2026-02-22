import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId

tap_bp = Blueprint('tap', __name__)


def get_db():
    from app import db
    return db


def broadcast_tap(tap_event):
    """Push tap event to all SSE clients."""
    from app import sse_clients
    dead = []
    for i, q in enumerate(sse_clients):
        try:
            q.put_nowait(tap_event)
        except Exception:
            dead.append(i)
    for i in reversed(dead):
        sse_clients.pop(i)


def serialize_tap(tap):
    tap['_id'] = str(tap['_id'])
    if isinstance(tap.get('user_id'), ObjectId):
        tap['user_id'] = str(tap['user_id'])
    return tap


def normalize_uid(raw_uid: str) -> str:
    """Normalize a card UID to uppercase hex without separators.
    Handles: '27:9A:99:54', '279A9954', '27-9A-99-54', '27 9A 99 54'
    """
    return raw_uid.replace(':', '').replace('-', '').replace(' ', '').upper()


_TYPE_TO_MODE = {
    'attendance': 'attendance',
    'event': 'event',
    'inventory': 'equipment',
}


def _update_gamification(db, user, action, is_first_arrival=False):
    """Award XP, update streaks, and grant badges after each tap."""
    uid = user['_id']
    today = datetime.datetime.utcnow().date()
    pts = 0
    set_fields = {}
    badges = []

    if action == 'attendance':
        pts = 10

        if is_first_arrival:
            pts += 25
            if 'early_bird' not in user.get('badges', []):
                badges.append('early_bird')

        # Streak — only update once per day
        last_raw = user.get('last_attendance_date')
        last_date = None
        if last_raw:
            last_date = last_raw.date() if isinstance(last_raw, datetime.datetime) else last_raw

        if last_date != today:
            set_fields['last_attendance_date'] = datetime.datetime.utcnow()
            new_streak = (
                user.get('current_streak', 0) + 1
                if last_date == today - datetime.timedelta(days=1)
                else 1
            )
            set_fields['current_streak'] = new_streak
            if new_streak > user.get('best_streak', 0):
                set_fields['best_streak'] = new_streak

            existing = user.get('badges', [])
            if new_streak >= 3 and 'streak_3' not in existing:
                badges.append('streak_3')
                pts += 20
            if new_streak >= 7 and 'streak_7' not in existing:
                badges.append('streak_7')
                pts += 50
            if new_streak >= 30 and 'streak_30' not in existing:
                badges.append('streak_30')
                pts += 200

    elif action == 'event_checkin':
        pts = 15
        checkins = db.events.count_documents({'checked_in': uid})
        if checkins >= 5 and 'society_star' not in user.get('badges', []):
            badges.append('society_star')

    elif action == 'equipment_checkout':
        pts = 5

    inc_fields = {}
    if pts:
        inc_fields['points'] = pts
    if is_first_arrival and action == 'attendance':
        inc_fields['first_arrivals'] = 1

    update = {}
    if inc_fields:
        update['$inc'] = inc_fields
    if set_fields:
        update['$set'] = set_fields
    if badges:
        update['$addToSet'] = {'badges': {'$each': badges}}

    if update:
        db.users.update_one({'_id': uid}, update)

    # Post-update: century + top_10 badges
    if pts:
        refreshed = db.users.find_one({'_id': uid})
        new_pts = refreshed.get('points', 0)
        post = []
        if new_pts >= 100 and 'century' not in refreshed.get('badges', []):
            post.append('century')
        rank = db.users.count_documents({'points': {'$gt': new_pts}}) + 1
        if rank <= 10 and 'top_10' not in refreshed.get('badges', []):
            post.append('top_10')
        if post:
            db.users.update_one({'_id': uid}, {'$addToSet': {'badges': {'$each': post}}})


def process_tap_core(device_id: str, card_uid: str, mode_override: str = None):
    """Core tap processing logic. Returns (response_dict, status_code).

    Looks up user by card_uid, resolves device mode, performs the
    appropriate action (attendance / equipment / event), stores the
    tap event, and broadcasts via SSE.

    mode_override: if provided, overrides the device's configured mode.
    """
    db = get_db()

    # Look up user by card_uid
    user = db.users.find_one({'card_uid': card_uid})
    if not user:
        return {'message': 'Card not registered', 'card_uid': card_uid}, 404

    # Look up device
    device = db.devices.find_one({'device_id': device_id})
    if not device:
        return {'message': 'Device not registered', 'device_id': device_id}, 404

    # Update device last_seen
    db.devices.update_one(
        {'_id': device['_id']},
        {'$set': {'is_online': True, 'last_seen': datetime.datetime.utcnow()}}
    )

    mode = mode_override if mode_override else device['mode']
    config = device.get('config', {})
    action = None
    context = ''
    is_first_arrival = False

    if mode == 'attendance':
        action = 'attendance'
        lecture_id = config.get('lecture_id')
        if lecture_id:
            lecture = db.lectures.find_one({'_id': ObjectId(lecture_id)})
            if lecture:
                is_first_arrival = len(lecture.get('attendees', [])) == 0
                context = f"{lecture['name']} — {lecture['room']}"
                db.lectures.update_one(
                    {'_id': ObjectId(lecture_id)},
                    {'$addToSet': {'attendees': user['_id']}}
                )

    elif mode == 'equipment':
        equip = db.equipment.find_one({'device_id': device_id})
        if equip:
            context = f"{equip['name']} — {equip['location']}"
            if equip['status'] == 'available' or (equip['status'] == 'in-use' and equip.get('current_user_id') == user['_id']):
                if equip['status'] == 'available':
                    action = 'equipment_checkout'
                    db.equipment.update_one(
                        {'_id': equip['_id']},
                        {'$set': {'status': 'in-use', 'current_user_id': user['_id'], 'checkout_time': datetime.datetime.utcnow()}}
                    )
                else:
                    action = 'equipment_return'
                    if equip.get('queue') and len(equip['queue']) > 0:
                        next_user = equip['queue'][0]
                        db.equipment.update_one(
                            {'_id': equip['_id']},
                            {'$set': {'current_user_id': next_user, 'checkout_time': datetime.datetime.utcnow()},
                             '$pop': {'queue': -1}}
                        )
                    else:
                        db.equipment.update_one(
                            {'_id': equip['_id']},
                            {'$set': {'status': 'available', 'current_user_id': None, 'checkout_time': None}}
                        )
            else:
                action = 'equipment_checkout'
                context += ' (queued)'
                db.equipment.update_one(
                    {'_id': equip['_id']},
                    {'$addToSet': {'queue': user['_id']}}
                )

    elif mode == 'event':
        event_id = config.get('event_id')
        if event_id:
            event = db.events.find_one({'_id': ObjectId(event_id)})
        else:
            # Fallback: find an event associated with this device_id
            event = db.events.find_one({'device_id': device_id})
        if event:
            action = 'event_checkin'
            is_first_arrival = len(event.get('checked_in', [])) == 0
            society = db.societies.find_one({'_id': event['society_id']})
            soc_name = society['name'] if society else 'Unknown'
            context = f"{event['name']} — {soc_name}"
            db.events.update_one(
                {'_id': event['_id']},
                {'$addToSet': {'checked_in': user['_id']}}
            )

    if not action:
        return {'message': 'Could not process tap'}, 400

    # Fallback: use device location if no context was set by mode logic
    if not context:
        context = device.get('location', device_id)

    # Store tap event
    tap_event = {
        'user_id': user['_id'],
        'user_name': user['name'],
        'device_id': device_id,
        'action': action,
        'context': context,
        'timestamp': datetime.datetime.utcnow(),
    }

    result = db.tap_events.insert_one(tap_event)
    tap_event['_id'] = result.inserted_id

    # Award XP, update streaks, grant badges
    _update_gamification(db, user, action, is_first_arrival=is_first_arrival)

    # Broadcast via SSE
    broadcast_data = serialize_tap({**tap_event})
    broadcast_data['timestamp'] = tap_event['timestamp'].isoformat()
    broadcast_data['is_first_arrival'] = is_first_arrival
    broadcast_tap(broadcast_data)

    response = serialize_tap({
        **tap_event,
        'timestamp': tap_event['timestamp'].isoformat(),
    })
    response['is_first_arrival'] = is_first_arrival
    return response, 201


# ─── Tap history endpoint ────────────────────────────

@tap_bp.route('/tap-events', methods=['GET'])
def get_tap_events():
    """Return recent tap events, newest first."""
    db = get_db()
    limit = min(int(request.args.get('limit', 50)), 200)
    action = request.args.get('action')
    user_id = request.args.get('user_id')

    query = {}
    if action:
        query['action'] = action
    if user_id:
        try:
            query['user_id'] = ObjectId(user_id)
        except Exception:
            pass

    events = list(db.tap_events.find(query).sort('timestamp', -1).limit(limit))
    result = []
    for e in events:
        result.append({
            '_id': str(e['_id']),
            'user_id': str(e['user_id']),
            'user_name': e['user_name'],
            'device_id': e['device_id'],
            'action': e['action'],
            'context': e['context'],
            'timestamp': e['timestamp'].isoformat(),
        })
    return jsonify(result)


# ─── Stats endpoint ──────────────────────────────────

@tap_bp.route('/stats', methods=['GET'])
def get_stats():
    """Return real-time dashboard statistics."""
    db = get_db()
    now = datetime.datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow = today + datetime.timedelta(days=1)
    next_week = today + datetime.timedelta(days=7)

    taps_today = db.tap_events.count_documents({'timestamp': {'$gte': today, '$lt': tomorrow}})

    # Attendance rate scoped to today's lectures; fall back to all-time if none today
    today_lectures = list(db.lectures.find({'start_time': {'$gte': today, '$lt': tomorrow}}))
    source_lectures = today_lectures if today_lectures else list(db.lectures.find())
    total_checked = sum(len(l.get('attendees', [])) for l in source_lectures)
    total_expected = sum(l.get('expected_students', 0) for l in source_lectures)
    attendance_rate = round(total_checked / total_expected * 100) if total_expected > 0 else 0

    equipment = list(db.equipment.find())
    active_queues = sum(1 for e in equipment if e.get('queue'))
    queue_students = sum(len(e.get('queue', [])) for e in equipment)

    events_this_week = db.events.count_documents({'date': {'$gte': today, '$lt': next_week}})

    # Unique students who tapped today
    active_students = len(db.tap_events.distinct('user_id', {'timestamp': {'$gte': today, '$lt': tomorrow}}))

    return jsonify({
        'taps_today': taps_today,
        'attendance_rate': attendance_rate,
        'active_queues': active_queues,
        'queue_students': queue_students,
        'events_this_week': events_this_week,
        'active_students': active_students,
    })


# ─── ESP32 endpoint ──────────────────────────────────
# Receives: { "uid": "27:9A:99:54", "ts": 1739999999 }
# All readers are attendance readers for now.
# Later: "type" field in the packet to specify mode.

@tap_bp.route('/nfc-events', methods=['POST'])
def nfc_event():
    """ESP32 tap endpoint.
    Accepts { "uid": "27:9A:99:54", "device_id": "UNITAP-001" }.
    If device_id is provided, routes through process_tap_core so the device's
    configured lecture/mode is used (different readers → different rooms).
    Falls back to time-based lookup if device_id is omitted.
    """
    data = request.get_json()

    raw_uid = data.get('uid')
    if not raw_uid:
        return jsonify({'message': 'uid required'}), 400

    card_uid = normalize_uid(raw_uid)

    # Preferred path: device_id present → full device-config-aware logic
    device_id = data.get('device_id')

    # Map the optional "type" field from the ESP32 payload to an internal mode
    raw_type = data.get('type', '')
    mode_override = _TYPE_TO_MODE.get(raw_type) if raw_type else None

    if device_id:
        result, status = process_tap_core(device_id, card_uid, mode_override=mode_override)
        return jsonify(result), status

    # Legacy fallback: no device_id — find the live lecture by time
    db = get_db()
    user = db.users.find_one({'card_uid': card_uid})
    if not user:
        return jsonify({'message': 'Card not registered', 'card_uid': card_uid}), 404

    now = datetime.datetime.utcnow()
    lecture = db.lectures.find_one({
        'start_time': {'$lte': now + datetime.timedelta(minutes=15)},
        'end_time': {'$gte': now},
    })
    if not lecture:
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)
        lecture = db.lectures.find_one(
            {'start_time': {'$gte': today}},
            sort=[('start_time', 1)]
        )

    resolved_device_id = 'ESP32'
    context = ''

    if lecture:
        context = f"{lecture['name']} — {lecture['room']}"
        resolved_device_id = lecture.get('device_id', 'ESP32')
        db.lectures.update_one(
            {'_id': lecture['_id']},
            {'$addToSet': {'attendees': user['_id']}}
        )

    tap_event = {
        'user_id': user['_id'],
        'user_name': user['name'],
        'device_id': resolved_device_id,
        'action': 'attendance',
        'context': context,
        'timestamp': datetime.datetime.utcnow(),
    }

    result = db.tap_events.insert_one(tap_event)
    tap_event['_id'] = result.inserted_id

    broadcast_data = serialize_tap({**tap_event})
    broadcast_data['timestamp'] = tap_event['timestamp'].isoformat()
    broadcast_tap(broadcast_data)

    return jsonify(serialize_tap({
        **tap_event,
        'timestamp': tap_event['timestamp'].isoformat(),
    })), 201


# ─── Original tap endpoint (frontend / generic) ─────
@tap_bp.route('/tap', methods=['POST'])
def process_tap():
    data = request.get_json()

    device_id = data.get('device_id')
    card_uid = data.get('card_uid')

    if not device_id or not card_uid:
        return jsonify({'message': 'device_id and card_uid required'}), 400

    raw_type = data.get('type', '')
    mode_override = _TYPE_TO_MODE.get(raw_type) if raw_type else None

    # Normalize in case it comes with separators
    card_uid = normalize_uid(card_uid)

    result, status = process_tap_core(device_id, card_uid, mode_override=mode_override)
    return jsonify(result), status


# ─── Demo simulate endpoint ─────────────────────────
@tap_bp.route('/tap/simulate', methods=['POST'])
def simulate_tap():
    """Demo endpoint: simulate a tap without real hardware.
    Rotates through all registered devices and users with linked cards
    so each call produces a tap from a different device/room.
    Pass device_id and/or card_uid in the body to override.
    """
    import random
    data = request.get_json() or {}
    db = get_db()

    device_id = data.get('device_id')
    card_uid = data.get('card_uid')

    if not device_id:
        # Pick a random device that has a non-empty config (attendance/event devices)
        # so we get varied contexts across different rooms
        devices = list(db.devices.find({'config': {'$ne': {}}, 'is_online': True}))
        if not devices:
            devices = list(db.devices.find())
        if not devices:
            return jsonify({'message': 'No devices registered. Seed the database first.'}), 400
        device_id = random.choice(devices)['device_id']

    if not card_uid:
        # Pick a random user with a linked card
        users_with_cards = list(db.users.find({'card_uid': {'$nin': [None, '']}}))
        if not users_with_cards:
            return jsonify({'message': 'No users with linked cards. Seed the database first.'}), 400
        card_uid = random.choice(users_with_cards)['card_uid']

    result, status = process_tap_core(device_id, card_uid)
    return jsonify(result), status
