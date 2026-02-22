import datetime
from flask import Blueprint, request, jsonify
from bson import ObjectId

devices_bp = Blueprint('devices', __name__)


def get_db():
    from app import db
    return db


def serialize_device(device):
    return {
        '_id': str(device['_id']),
        'device_id': device['device_id'],
        'name': device['name'],
        'location': device.get('location', ''),
        'mode': device['mode'],
        'config': device.get('config', {}),
        'is_online': device.get('is_online', False),
        'last_seen': device['last_seen'].isoformat() if device.get('last_seen') and hasattr(device['last_seen'], 'isoformat') else str(device.get('last_seen', '')),
    }


@devices_bp.route('', methods=['GET'])
def get_all():
    db = get_db()
    devices = list(db.devices.find())
    return jsonify([serialize_device(d) for d in devices])


@devices_bp.route('', methods=['POST'])
def register_device():
    data = request.get_json()
    db = get_db()

    device = {
        'device_id': data['device_id'],
        'name': data['name'],
        'location': data.get('location', ''),
        'mode': data['mode'],
        'config': data.get('config', {}),
        'is_online': True,
        'last_seen': datetime.datetime.utcnow(),
    }

    result = db.devices.insert_one(device)
    device['_id'] = result.inserted_id
    return jsonify(serialize_device(device)), 201


@devices_bp.route('/<device_id>', methods=['PATCH'])
def update_device(device_id):
    data = request.get_json()
    db = get_db()

    update = {}
    if 'mode' in data:
        update['mode'] = data['mode']
    if 'config' in data:
        update['config'] = data['config']

    if not update:
        return jsonify({'message': 'Nothing to update'}), 400

    db.devices.update_one({'_id': ObjectId(device_id)}, {'$set': update})
    device = db.devices.find_one({'_id': ObjectId(device_id)})
    if not device:
        return jsonify({'message': 'Device not found'}), 404

    return jsonify(serialize_device(device))
