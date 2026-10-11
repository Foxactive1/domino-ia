import copy
import unittest

import server
from online_game import can_play


class MultiplayerTests(unittest.TestCase):
    def setUp(self):
        server.rooms.clear()
        self.clients = [server.socketio.test_client(server.app) for _ in range(3)]
        self.host = self.clients[0].emit('create_game', {'name': 'Dione'}, callback=True)
        self.code = self.host['roomCode']
        self.room = server.rooms[self.code]

    def tearDown(self):
        for client in self.clients:
            if client.is_connected():
                client.disconnect()

    def join(self):
        return self.clients[1].emit('join_game', {'roomCode': self.code, 'name': 'Amigo'}, callback=True)

    def play(self, player, **payload):
        return self.clients[player].emit('play_move', {'roomCode': self.code, 'revision': self.room['revision'], **payload}, callback=True)

    def test_private_state_and_full_room(self):
        self.assertTrue(self.join()['ok'])
        for i, client in enumerate(self.clients[:2]):
            state = [e['args'][0] for e in client.get_received() if e['name'] == 'room_state'][-1]
            self.assertEqual(state['hand'], self.room['hands'][i])
            self.assertEqual(state['opponentCount'], 7)
            self.assertNotIn('stock', state)
            self.assertNotIn('hands', state)
            self.assertFalse(any('token' in p or 'sid' in p for p in state['players']))
        self.assertFalse(self.clients[2].emit('join_game', {'roomCode': self.code}, callback=True)['ok'])

    def test_waiting_turn_and_membership(self):
        self.assertFalse(self.play(0, action='play', index=0, side='left')['ok'])
        self.join()
        before = copy.deepcopy(self.room)
        self.assertFalse(self.play(1, action='play', index=0, side='left')['ok'])
        self.assertFalse(self.play(2, action='play', index=0, side='left')['ok'])
        self.assertEqual(self.room, before)
        self.assertTrue(self.play(0, action='play', index=0, side='left')['ok'])
        self.assertEqual(self.room['turn'], 1)

    def test_invalid_indexes_sides_and_stale_revision(self):
        self.join()
        for index in [True, -1, 7, '0', None]:
            self.assertFalse(self.play(0, action='play', index=index, side='left')['ok'])
        self.assertFalse(self.play(0, action='play', index=0, side='up')['ok'])
        response = self.clients[0].emit('play_move', {'roomCode': self.code, 'revision': -1, 'action': 'play', 'index': 0, 'side': 'left'}, callback=True)
        self.assertFalse(response['ok'])
        self.assertEqual(len(self.room['board']), 0)

    def test_draw_pass_and_reverse(self):
        self.join()
        self.room.update(hands=[[[1, 2], [5, 5]], [[4, 4]]], stock=[[0, 0], [6, 6]], board=[[1, 3]], ends=[1, 3])
        self.assertFalse(self.play(0, action='draw')['ok'])
        self.assertFalse(self.play(0, action='pass')['ok'])
        self.assertFalse(self.play(0, action='play', index=0, side='right')['ok'])
        self.assertTrue(self.play(0, action='play', index=0, side='left')['ok'])
        self.assertEqual(self.room['board'][0], [2, 1])
        self.assertEqual(self.room['hands'][0], [[5, 5]])
        self.assertTrue(self.play(1, action='draw')['ok'])
        self.assertEqual(self.room['turn'], 1)
        self.assertTrue(self.play(1, action='pass')['ok'])
        self.assertIsNone(self.room['result'])

    def test_disconnect_pause_and_reconnect_token(self):
        token = self.join()['token']
        self.clients[1].disconnect()
        self.assertFalse(self.play(0, action='play', index=0, side='left')['ok'])
        self.assertFalse(self.clients[2].emit('join_game', {'roomCode': self.code, 'token': 'wrong'}, callback=True)['ok'])
        result = self.clients[2].emit('join_game', {'roomCode': self.code, 'token': token}, callback=True)
        self.assertTrue(result['ok'])
        self.assertTrue(self.room['players'][1]['connected'])
        self.assertTrue(self.play(0, action='play', index=0, side='left')['ok'])

    def test_rematch_requires_both_and_alternates_starter(self):
        self.join()
        self.assertFalse(self.clients[0].emit('new_round', {'roomCode': self.code}, callback=True)['ok'])
        self.room.update(hands=[[[1, 1]], [[2, 2]]], board=[], ends=[None, None])
        self.assertTrue(self.play(0, action='play', index=0, side='left')['ok'])
        self.assertEqual(self.room['scores'][0], 1)
        self.assertTrue(self.clients[0].emit('new_round', {'roomCode': self.code}, callback=True)['ok'])
        self.assertEqual(self.room['round'], 1)
        self.clients[0].emit('new_round', {'roomCode': self.code}, callback=True)
        self.assertEqual(self.room['rematch'], [0])
        self.clients[1].emit('new_round', {'roomCode': self.code}, callback=True)
        self.assertEqual(self.room['round'], 2)
        self.assertEqual(self.room['turn'], 1)
        self.assertEqual(self.room['scores'][0], 1)

    def test_full_random_matches(self):
        self.join()
        for _ in range(50):
            moves = 0
            while self.room['result'] is None and moves < 300:
                i = self.room['turn']
                hand = self.room['hands'][i]
                index = next((j for j, tile in enumerate(hand) if can_play(self.room, tile)), None)
                if index is not None:
                    side = 'left' if not self.room['board'] or self.room['ends'][0] in hand[index] else 'right'
                    response = self.play(i, action='play', index=index, side=side)
                else:
                    response = self.play(i, action='draw' if self.room['stock'] else 'pass')
                self.assertTrue(response['ok'])
                tiles = self.room['hands'][0] + self.room['hands'][1] + self.room['stock'] + self.room['board']
                self.assertEqual(len(tiles), 28)
                self.assertEqual(len({tuple(sorted(t)) for t in tiles}), 28)
                for a, b in zip(self.room['board'], self.room['board'][1:]):
                    self.assertEqual(a[1], b[0])
                moves += 1
            self.assertIsNotNone(self.room['result'])
            for c in self.clients[:2]:
                self.assertTrue(c.emit('new_round', {'roomCode': self.code}, callback=True)['ok'])

    def test_leave_expiry_and_http_allowlist(self):
        self.join()
        self.clients[0].emit('leave_game', {}, callback=True)
        self.assertNotIn(self.code, server.rooms)
        self.assertTrue(any(e['name'] == 'room_closed' for e in self.clients[1].get_received()))
        new = self.clients[0].emit('create_game', {}, callback=True)
        server.rooms[new['roomCode']]['updated'] = 0
        response = server.app.test_client().get('/health')
        self.assertEqual(response.json['activeRooms'], 0)
        http = server.app.test_client()
        for path in ['/', '/jogo.js', '/online.js', '/vendor/socket.io.min.js']:
            response = http.get(path)
            self.assertEqual(response.status_code, 200)
            response.close()
        for path in ['/server.py', '/requirements.txt', '/online_game.py']:
            self.assertEqual(http.get(path).status_code, 404)


if __name__ == '__main__':
    unittest.main()
