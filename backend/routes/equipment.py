from flask import Blueprint, request, jsonify
from bson import ObjectId

equipment_bp = Blueprint('equipment', __name__)


def get_db():
    from app import db
    return db


def serialize_equipment(equip):
    return {
        '_id': str(equip['_id']),
        'name': equip['name'],
        'location': equip['location'],
        'device_id': equip.get('device_id', ''),
        'status': equip.get('status', 'available'),
        'current_user': str(equip['current_user_id']) if equip.get('current_user_id') else None,
        'queue': [str(uid) for uid in equip.get('queue', [])],
        'checkout_time': equip['checkout_time'].isoformat() if equip.get('checkout_time') else None,
    }


@equipment_bp.route('', methods=['GET'])
def get_all():
    db = get_db()
    items = list(db.equipment.find())
    return jsonify([serialize_equipment(e) for e in items])


@equipment_bp.route('/<equipment_id>', methods=['GET'])
def get_detail(equipment_id):
    db = get_db()
    equip = db.equipment.find_one({'_id': ObjectId(equipment_id)})
    if not equip:
        return jsonify({'message': 'Equipment not found'}), 404
    return jsonify(serialize_equipment(equip))


@equipment_bp.route('/<equipment_id>/queue', methods=['POST'])
def join_queue(equipment_id):
    data = request.get_json()
    db = get_db()

    user_id = ObjectId(data['user_id'])
    db.equipment.update_one(
        {'_id': ObjectId(equipment_id)},
        {'$addToSet': {'queue': user_id}}
    )

    equip = db.equipment.find_one({'_id': ObjectId(equipment_id)})
    return jsonify(serialize_equipment(equip))


@equipment_bp.route('/<equipment_id>/queue', methods=['DELETE'])
def leave_queue(equipment_id):
    data = request.get_json()
    db = get_db()

    user_id = ObjectId(data['user_id'])
    db.equipment.update_one(
        {'_id': ObjectId(equipment_id)},
        {'$pull': {'queue': user_id}}
    )

    equip = db.equipment.find_one({'_id': ObjectId(equipment_id)})
    return jsonify(serialize_equipment(equip))
