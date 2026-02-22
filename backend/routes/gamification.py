import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId

gamification_bp = Blueprint('gamification', __name__)

BADGE_META = {
    'early_bird':   {'label': 'Early Bird',   'color': 'warning'},
    'streak_3':     {'label': '3-Day Streak',  'color': 'success'},
    'streak_7':     {'label': 'Week Warrior',  'color': 'orange'},
    'streak_30':    {'label': 'Month Master',  'color': 'error'},
    'century':      {'label': '100+ XP',       'color': 'blue'},
    'society_star': {'label': 'Society Star',  'color': 'success'},
    'top_10':       {'label': 'Top 10',        'color': 'warning'},
}


def get_db():
    from app import db
    return db


def _get_auth_payload():
    token = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not token:
        return None
    import jwt as pyjwt
    from app import app
    try:
        return pyjwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
    except Exception:
        return None


def _serialize_entry(user, rank, total_users=None):
    entry = {
        '_id': str(user['_id']),
        'name': user['name'],
        'university': user.get('university', ''),
        'points': user.get('points', 0),
        'current_streak': user.get('current_streak', 0),
        'best_streak': user.get('best_streak', 0),
        'first_arrivals': user.get('first_arrivals', 0),
        'badges': user.get('badges', []),
        'rank': rank,
    }
    if total_users is not None:
        entry['total_users'] = total_users
    return entry


@gamification_bp.route('/leaderboard', methods=['GET'])
def get_leaderboard():
    db = get_db()
    period = request.args.get('period', 'all')  # 'all' or 'week'

    if period == 'week':
        since = datetime.datetime.utcnow() - datetime.timedelta(days=7)
        pipeline = [
            {'$match': {'timestamp': {'$gte': since}, 'action': 'attendance'}},
            {'$group': {'_id': '$user_id', 'taps': {'$sum': 1}}},
            {'$sort': {'taps': -1}},
            {'$limit': 20},
        ]
        weekly = list(db.tap_events.aggregate(pipeline))
        user_ids = [e['_id'] for e in weekly]
        users_map = {u['_id']: u for u in db.users.find({'_id': {'$in': user_ids}})}

        entries = []
        for rank, entry in enumerate(weekly, 1):
            u = users_map.get(entry['_id'])
            if u:
                e = _serialize_entry(u, rank)
                e['points'] = entry['taps'] * 10  # weekly points = taps × 10
                e['weekly_taps'] = entry['taps']
                entries.append(e)
    else:
        # All-time: rank by total attendance tap count (same logic as weekly, no date filter)
        pipeline = [
            {'$match': {'action': 'attendance'}},
            {'$group': {'_id': '$user_id', 'taps': {'$sum': 1}}},
            {'$sort': {'taps': -1}},
            {'$limit': 20},
        ]
        all_time = list(db.tap_events.aggregate(pipeline))
        user_ids = [e['_id'] for e in all_time]
        users_map = {u['_id']: u for u in db.users.find({'_id': {'$in': user_ids}})}

        entries = []
        for rank, entry in enumerate(all_time, 1):
            u = users_map.get(entry['_id'])
            if u:
                e = _serialize_entry(u, rank)
                e['points'] = entry['taps'] * 10
                e['weekly_taps'] = entry['taps']
                entries.append(e)

    # Current user's standing
    me = None
    payload = _get_auth_payload()
    if payload:
        user_id = payload.get('user_id')
        if user_id:
            user = db.users.find_one({'_id': ObjectId(user_id)})
            if user:
                total = db.users.count_documents({})
                if period == 'all':
                    my_taps = db.tap_events.count_documents({
                        'user_id': ObjectId(user_id),
                        'action': 'attendance',
                    })
                    ahead = list(db.tap_events.aggregate([
                        {'$match': {'action': 'attendance'}},
                        {'$group': {'_id': '$user_id', 'taps': {'$sum': 1}}},
                        {'$match': {'taps': {'$gt': my_taps}}},
                        {'$count': 'ahead'},
                    ]))
                    rank = (ahead[0]['ahead'] if ahead else 0) + 1
                    user_copy = dict(user)
                    user_copy['points'] = my_taps * 10
                    me = _serialize_entry(user_copy, rank, total_users=total)
                else:
                    since = datetime.datetime.utcnow() - datetime.timedelta(days=7)
                    my_taps = db.tap_events.count_documents({
                        'user_id': ObjectId(user_id),
                        'timestamp': {'$gte': since},
                        'action': 'attendance',
                    })
                    ahead = list(db.tap_events.aggregate([
                        {'$match': {'timestamp': {'$gte': since}, 'action': 'attendance'}},
                        {'$group': {'_id': '$user_id', 'taps': {'$sum': 1}}},
                        {'$match': {'taps': {'$gt': my_taps}}},
                        {'$count': 'ahead'},
                    ]))
                    rank = (ahead[0]['ahead'] if ahead else 0) + 1
                    user_copy = dict(user)
                    user_copy['points'] = my_taps * 10
                    me = _serialize_entry(user_copy, rank, total_users=total)

    return jsonify({'leaderboard': entries, 'me': me})


@gamification_bp.route('/me', methods=['GET'])
def get_my_stats():
    db = get_db()
    payload = _get_auth_payload()
    if not payload:
        return jsonify({'message': 'Token required'}), 401

    user_id = payload.get('user_id')
    user = db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        return jsonify({'message': 'User not found'}), 404

    rank = db.users.count_documents({'points': {'$gt': user.get('points', 0)}}) + 1
    total = db.users.count_documents({})
    return jsonify(_serialize_entry(user, rank, total_users=total))


@gamification_bp.route('/badges', methods=['GET'])
def get_badge_meta():
    """Return badge definitions for frontend display."""
    return jsonify(BADGE_META)
