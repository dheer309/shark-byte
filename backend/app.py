import os
import queue
from flask import Flask
from flask_cors import CORS
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'unitap-hackathon-secret-2025')
CORS(app, origins=['http://localhost:5173', 'http://10.70.159.4:5173', 'https://10.70.159.4:5173'])

# MongoDB
mongo_uri = os.getenv('MONGO_URI', 'mongodb://localhost:27017')
mongo_client = MongoClient(mongo_uri)
db = mongo_client['unitap']

# Auto-expire pending OTP verifications after 10 minutes
db.pending_verifications.create_index("created_at", expireAfterSeconds=600)

# SSE: shared queue for broadcasting tap events to all connected clients
sse_clients: list[queue.Queue] = []

# Register blueprints
from routes.auth import auth_bp
from routes.tap import tap_bp
from routes.attendance import attendance_bp
from routes.equipment import equipment_bp
from routes.societies import societies_bp
from routes.devices import devices_bp
from routes.stream import stream_bp
from routes.gamification import gamification_bp

app.register_blueprint(auth_bp, url_prefix='/api/auth')
app.register_blueprint(tap_bp, url_prefix='/api')
app.register_blueprint(attendance_bp, url_prefix='/api/attendance')
app.register_blueprint(equipment_bp, url_prefix='/api/equipment')
app.register_blueprint(societies_bp, url_prefix='/api/societies')
app.register_blueprint(devices_bp, url_prefix='/api/devices')
app.register_blueprint(stream_bp, url_prefix='/api/stream')
app.register_blueprint(gamification_bp, url_prefix='/api/gamification')


@app.route('/api/health')
def health():
    return {'status': 'ok'}


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True, threaded=True)
