import json
import queue
from flask import Blueprint, Response

stream_bp = Blueprint('stream', __name__)


@stream_bp.route('/taps')
def tap_stream():
    """Server-Sent Events stream for live tap updates."""
    from app import sse_clients

    q = queue.Queue()
    sse_clients.append(q)

    def generate():
        try:
            while True:
                try:
                    data = q.get(timeout=30)
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    # Send keepalive comment to prevent timeout
                    yield ": keepalive\n\n"
        except GeneratorExit:
            if q in sse_clients:
                sse_clients.remove(q)

    return Response(
        generate(),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )
