import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId

attendance_bp = Blueprint('attendance', __name__)


def get_db():
    from app import db
    return db


def serialize_lecture(lecture):
    now = datetime.datetime.utcnow()
    start = lecture.get('start_time', now)
    end = lecture.get('end_time', now)

    if now < start:
        status = 'upcoming'
    elif now > end:
        status = 'ended'
    else:
        status = 'live'

    return {
        '_id': str(lecture['_id']),
        'name': lecture['name'],
        'professor': lecture['professor'],
        'room': lecture['room'],
        'start_time': start.isoformat(),
        'end_time': end.isoformat(),
        'device_id': lecture.get('device_id', ''),
        'expected_students': lecture.get('expected_students', 0),
        'checked_in': len(lecture.get('attendees', [])),
        'status': status,
    }


@attendance_bp.route('/lectures', methods=['GET'])
def get_lectures():
    db = get_db()
    date_str = request.args.get('date')
    status_filter = request.args.get('status')

    query = {}
    if date_str:
        try:
            date = datetime.datetime.strptime(date_str, '%Y-%m-%d')
            next_day = date + datetime.timedelta(days=1)
            query['start_time'] = {'$gte': date, '$lt': next_day}
        except ValueError:
            pass

    lectures = list(db.lectures.find(query).sort('start_time', 1))
    serialized = [serialize_lecture(l) for l in lectures]

    if status_filter:
        serialized = [l for l in serialized if l['status'] == status_filter]

    return jsonify(serialized)


@attendance_bp.route('/lectures/<lecture_id>', methods=['GET'])
def get_lecture_detail(lecture_id):
    db = get_db()
    lecture = db.lectures.find_one({'_id': ObjectId(lecture_id)})
    if not lecture:
        return jsonify({'message': 'Lecture not found'}), 404

    result = serialize_lecture(lecture)

    # Include attendee details
    attendee_ids = lecture.get('attendees', [])
    attendees = list(db.users.find({'_id': {'$in': attendee_ids}}))
    result['attendees'] = [
        {'_id': str(a['_id']), 'name': a['name'], 'email': a['email']}
        for a in attendees
    ]

    return jsonify(result)
