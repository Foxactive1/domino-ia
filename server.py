"""Servidor de salas. Uma instância/worker; estado privado mantido em memória."""
import os
import secrets
import threading
import time
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory
from flask_socketio import SocketIO
from online_game import InvalidMove, move, new_round, state_for

BASE = Path(__file__).resolve().parent
app = Flask(__name__, static_folder=None)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', secrets.token_hex(32))
socketio = SocketIO(app, async_mode='threading', cors_allowed_origins=None, max_http_buffer_size=8192)
rooms = {}
lock = threading.RLock()
TTL = int(os.environ.get('ROOM_TTL_SECONDS', '7200'))
MAX_ROOMS = int(os.environ.get('MAX_ROOMS', '300'))


def cleanup():
    for code, room in list(rooms.items()):
        if time.time() - room['updated'] > TTL:
            for player in room['players']:
                if player['sid']:
                    socketio.emit('room_closed', {'message': 'Sala expirada. Crie outra sala.'}, to=player['sid'])
            del rooms[code]


def identity(sid):
    for room in rooms.values():
        for i, player in enumerate(room['players']):
            if player['sid'] == sid:
                return room, i
    return None


def broadcast(room):
    for i, player in enumerate(room['players']):
        if player['connected']:
            socketio.emit('room_state', state_for(room, i), to=player['sid'])


def name(value):
    return (' '.join(value.split())[:32] or 'Jogador') if isinstance(value, str) else 'Jogador'


def player(payload):
    return {'name': name(payload.get('name')), 'token': secrets.token_urlsafe(32),
            'sid': request.sid, 'connected': True}


def guarded(fn):
    def wrapped(data=None):
        with lock:
            cleanup()
            try:
                return fn(data if isinstance(data, dict) else {})
            except InvalidMove as exc:
                return {'ok': False, 'error': str(exc)}
    wrapped.__name__ = fn.__name__
    return wrapped


def current(payload):
    found = identity(request.sid)
    if not found or found[0]['code'] != payload.get('roomCode'):
        raise InvalidMove('Você não pertence a esta sala.')
    return found


@app.get('/')
def index():
    return send_from_directory(BASE, 'index.html')


@app.get('/health')
def health():
    with lock:
        cleanup()
        return jsonify(status='ok', activeRooms=len(rooms))


@app.get('/<path:path>')
def assets(path):
    if path not in {'estilo.css', 'jogo.js', 'online.js', 'vendor/socket.io.min.js'}:
        abort(404)
    return send_from_directory(BASE, path)


@socketio.on('create_game')
@guarded
def create(payload):
    if identity(request.sid):
        raise InvalidMove('Saia da sala atual antes de criar outra.')
    if len(rooms) >= MAX_ROOMS:
        raise InvalidMove('Servidor cheio. Tente novamente mais tarde.')
    while True:
        code = ''.join(secrets.choice('ABCDEFGHJKLMNPQRSTUVWXYZ23456789') for _ in range(6))
        if code not in rooms:
            break
    p = player(payload)
    room = {'code': code, 'players': [p], 'starter': 0, 'round': 1,
            'scores': {0: 0, 1: 0, 'draws': 0}, 'updated': time.time()}
    new_round(room)
    rooms[code] = room
    broadcast(room)
    return {'ok': True, 'roomCode': code, 'token': p['token']}


@socketio.on('join_game')
@guarded
def join(payload):
    code = str(payload.get('roomCode', '')).strip().upper()
    room = rooms.get(code)
    if not room:
        raise InvalidMove('Sala não encontrada ou expirada.')
    existing = identity(request.sid)
    if existing and existing[0] is not room:
        raise InvalidMove('Saia da sala atual antes de entrar em outra.')
    token = payload.get('token')
    match = next((p for p in room['players'] if isinstance(token, str) and token.isascii() and secrets.compare_digest(token, p['token'])), None)
    if match:
        old_sid = match['sid']
        if old_sid and old_sid != request.sid:
            socketio.emit('session_replaced', {}, to=old_sid)
        match.update(sid=request.sid, connected=True)
        p = match
    elif existing:
        p = room['players'][existing[1]]
    elif len(room['players']) == 1:
        p = player(payload)
        room['players'].append(p)
    else:
        raise InvalidMove('Esta sala já possui dois jogadores.')
    room['updated'] = time.time()
    broadcast(room)
    return {'ok': True, 'roomCode': code, 'token': p['token']}


@socketio.on('play_move')
@guarded
def play(payload):
    room, i = current(payload)
    move(room, i, payload)
    room['updated'] = time.time()
    broadcast(room)
    return {'ok': True}


@socketio.on('new_round')
@guarded
def rematch(payload):
    room, i = current(payload)
    if room['result'] is None:
        raise InvalidMove('Termine a rodada atual antes da revanche.')
    if len(room['players']) != 2 or not all(p['connected'] for p in room['players']):
        raise InvalidMove('Aguarde a reconexão do adversário.')
    if i not in room['rematch']:
        room['rematch'].append(i)
    if len(room['rematch']) == 2:
        room['starter'] = 1 - room['starter']
        room['round'] += 1
        new_round(room)
    room['updated'] = time.time()
    broadcast(room)
    return {'ok': True}


@socketio.on('leave_game')
@guarded
def leave(payload):
    found = identity(request.sid)
    if found:
        room, _ = found
        for p in room['players']:
            if p['sid']:
                socketio.emit('room_closed', {'message': 'Um jogador saiu. A sala foi encerrada.'}, to=p['sid'])
        del rooms[room['code']]
    return {'ok': True}


@socketio.on('disconnect')
def disconnected(reason=None):
    with lock:
        found = identity(request.sid)
        if found:
            room, i = found
            room['players'][i].update(sid=None, connected=False)
            room['updated'] = time.time()
            broadcast(room)


if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=int(os.environ.get('PORT', '5000')),
                 debug=False, allow_unsafe_werkzeug=True)
