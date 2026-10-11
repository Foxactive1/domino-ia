"""Teste opcional de rede real: pip install 'python-socketio[client]'."""
import json
import os
import socket
import subprocess
import sys
import threading
import time
from urllib.request import urlopen

import socketio

with socket.socket() as listener:
    listener.bind(('127.0.0.1', 0))
    port = listener.getsockname()[1]
url = f'http://127.0.0.1:{port}'
process = subprocess.Popen([sys.executable, '-m', 'gunicorn', '--workers', '1', '--threads', '8',
                            '--bind', f'127.0.0.1:{port}', 'server:app'],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
clients = [socketio.Client(reconnection=False) for _ in range(2)]
states = [{}, {}]
received = [threading.Event(), threading.Event()]
for i, client in enumerate(clients):
    def update(state, index=i):
        states[index] = state
        received[index].set()
    client.on('room_state', update)
try:
    deadline = time.monotonic() + 10
    while True:
        try:
            with urlopen(url + '/health', timeout=1) as response:
                assert json.load(response)['status'] == 'ok'
            break
        except OSError:
            if time.monotonic() > deadline:
                raise RuntimeError('Gunicorn não iniciou.')
            time.sleep(.1)
    clients[0].connect(url, transports=['websocket'])
    clients[1].connect(url, transports=['polling'])
    created = clients[0].call('create_game', {'name': 'Dione'}, timeout=5)
    assert created['ok']
    joined = clients[1].call('join_game', {'roomCode': created['roomCode'], 'name': 'Amigo'}, timeout=5)
    assert joined['ok']
    assert all(event.wait(5) for event in received)
    # Acknowledgements can precede listener-thread processing; wait for both updates.
    deadline = time.monotonic() + 5
    while len(states[0].get('players', [])) != 2:
        if time.monotonic() > deadline:
            raise RuntimeError('Estado não sincronizado.')
        time.sleep(.01)
    for event in received:
        event.clear()
    result = clients[0].call('play_move', {'roomCode': created['roomCode'], 'revision': states[0]['revision'],
                                          'action': 'play', 'index': 0, 'side': 'left'}, timeout=5)
    assert result['ok']
    assert all(event.wait(5) for event in received)
    assert len(states[0]['hand']) == 6
    assert states[0]['board'] == states[1]['board']
    assert states[1]['opponentCount'] == 6
    assert clients[0].transport() == 'websocket'
    assert clients[1].transport() == 'polling'
    print('PASS: Gunicorn, WebSocket e polling; sala, duas mãos privadas e jogada sincronizada.')
finally:
    for client in clients:
        if client.connected:
            client.disconnect()
    process.terminate()
    process.wait(timeout=10)
