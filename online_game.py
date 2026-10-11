"""Regras autoritativas do dominó duplo-seis para dois jogadores."""
import secrets


class InvalidMove(ValueError):
    pass


def new_round(room):
    tiles = [[a, b] for a in range(7) for b in range(a, 7)]
    secrets.SystemRandom().shuffle(tiles)
    room.update(hands=[tiles[:7], tiles[7:14]], stock=tiles[14:], board=[],
                ends=[None, None], turn=room['starter'], result=None,
                history=[], rematch=[], revision=room.get('revision', 0) + 1)


def can_play(room, tile):
    return not room['board'] or any(n in room['ends'] for n in tile)


def finish(room):
    winner = next((i for i, hand in enumerate(room['hands']) if not hand), None)
    if winner is None:
        if room['stock'] or any(can_play(room, t) for hand in room['hands'] for t in hand):
            return
        points = [sum(sum(t) for t in hand) for hand in room['hands']]
        winner = None if points[0] == points[1] else points.index(min(points))
    room['result'] = {'winner': winner}
    room['scores'][winner if winner is not None else 'draws'] += 1


def move(room, player, payload):
    if len(room['players']) != 2:
        raise InvalidMove('Aguardando o segundo jogador.')
    if not all(p['connected'] for p in room['players']):
        raise InvalidMove('Partida pausada: aguarde a reconexão do adversário.')
    if room['result'] is not None:
        raise InvalidMove('Esta rodada já terminou.')
    if room['turn'] != player:
        raise InvalidMove('Aguarde sua vez.')
    if type(payload.get('revision')) is not int or payload['revision'] != room['revision']:
        raise InvalidMove('A mesa mudou. Confira a posição atual e tente novamente.')
    action = payload.get('action')
    hand = room['hands'][player]
    if action == 'play':
        index, side = payload.get('index'), payload.get('side')
        if type(index) is not int or not 0 <= index < len(hand) or side not in ('left', 'right'):
            raise InvalidMove('Jogada inválida.')
        tile = list(hand[index])
        if not room['board']:
            room['board'].append(tile)
            room['ends'] = list(tile)
        else:
            end = room['ends'][0 if side == 'left' else 1]
            if end not in tile:
                raise InvalidMove('Esta peça não encaixa na extremidade escolhida.')
            if side == 'left':
                if tile[1] != end:
                    tile.reverse()
                room['board'].insert(0, tile)
                room['ends'][0] = tile[0]
            else:
                if tile[0] != end:
                    tile.reverse()
                room['board'].append(tile)
                room['ends'][1] = tile[1]
        hand.pop(index)
        room['history'].insert(0, f"{room['players'][player]['name']} jogou [{tile[0]}|{tile[1]}].")
        room['turn'] = 1 - player
    elif action == 'draw':
        if any(can_play(room, tile) for tile in hand) or not room['stock']:
            raise InvalidMove('Compre apenas quando não houver encaixe e houver reserva.')
        hand.append(room['stock'].pop())
        room['history'].insert(0, f"{room['players'][player]['name']} comprou uma peça.")
    elif action == 'pass':
        if any(can_play(room, tile) for tile in hand):
            raise InvalidMove('Você tem uma peça que pode jogar.')
        # Mesma variante do modo IA: permite passar com reserva disponível.
        room['turn'] = 1 - player
        room['history'].insert(0, f"{room['players'][player]['name']} passou a vez.")
    else:
        raise InvalidMove('Ação inválida.')
    room['history'] = room['history'][:5]
    room['revision'] += 1
    finish(room)


def state_for(room, player):
    return {'roomCode': room['code'], 'you': player, 'round': room['round'],
            'revision': room['revision'], 'hand': room['hands'][player],
            'opponentCount': len(room['hands'][1-player]), 'stockCount': len(room['stock']),
            'board': room['board'], 'ends': room['ends'], 'turn': room['turn'],
            'result': room['result'], 'scores': [room['scores'][0], room['scores'][1], room['scores']['draws']],
            'history': room['history'], 'rematch': room['rematch'],
            'players': [{'name': p['name'], 'connected': p['connected']} for p in room['players']]}
