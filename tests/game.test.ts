import { describe, expect, it } from 'vitest';

import { createEmptyBoard, getStone, pointToIndex } from '../src/domain/board';
import { boardKey } from '../src/domain/rules';
import { scoreArea } from '../src/domain/scoring';
import {
  confirmScoring,
  createGame,
  pass,
  playMove,
  toggleDeadGroup,
} from '../src/domain/game';
import type { GameState } from '../src/domain/game';
import type { Point } from '../src/domain/types';

const point = (row: number, column: number): Point => ({ row, column });

/**
 * A finished-by-passing game holding one two-stone group per color:
 * black at (4, 4)–(4, 5) and white at (2, 2)–(2, 3), phase `mark-dead`.
 */
const markDeadGame = (): GameState => {
  let game = createGame();
  game = playMove(game, point(4, 4)); // black
  game = playMove(game, point(2, 2)); // white
  game = playMove(game, point(4, 5)); // black
  game = playMove(game, point(2, 3)); // white
  return pass(pass(game));
};

/**
 * Snapshots the observable fields of a state so tests can assert that a
 * rejected action left every one of them untouched.
 */
const snapshot = (state: GameState) => ({
  board: [...state.board],
  currentPlayer: state.currentPlayer,
  phase: state.phase,
  consecutivePasses: state.consecutivePasses,
  seenBoardKeys: new Set(state.seenBoardKeys),
});

describe('createGame', () => {
  it('starts with an empty board', () => {
    const game = createGame();

    expect(game.board).toEqual(createEmptyBoard());
    expect(game.board.every((stone) => stone === null)).toBe(true);
  });

  it('starts with black to move in the play phase with zero passes', () => {
    const game = createGame();

    expect(game.currentPlayer).toBe('black');
    expect(game.phase).toBe('play');
    expect(game.consecutivePasses).toBe(0);
  });

  it('starts with no points marked dead', () => {
    const game = createGame();

    expect(new Set(game.deadPoints)).toEqual(new Set());
    expect(game.deadPoints.size).toBe(0);
  });

  it('seeds the position history with the empty board', () => {
    // Task 4 repeat detection needs every prior full position, including
    // the starting one, so a move may never recreate the empty board.
    const game = createGame();

    expect(game.seenBoardKeys.has(boardKey(createEmptyBoard()))).toBe(true);
  });
});

describe('playMove', () => {
  it('places a stone of the current player on a legal move', () => {
    const game = createGame();

    const afterBlack = playMove(game, point(4, 4));

    expect(getStone(afterBlack.board, 4, 4)).toBe('black');

    const afterWhite = playMove(afterBlack, point(2, 2));

    expect(getStone(afterWhite.board, 2, 2)).toBe('white');
  });

  it('passes the turn to the opponent after a legal move', () => {
    const game = createGame();

    const afterBlack = playMove(game, point(4, 4));

    expect(afterBlack.currentPlayer).toBe('white');
    expect(afterBlack.phase).toBe('play');
  });

  it('records the resulting position in the history after a legal move', () => {
    const game = createGame();

    const afterBlack = playMove(game, point(4, 4));

    expect(afterBlack.seenBoardKeys.has(boardKey(afterBlack.board))).toBe(
      true,
    );
  });

  it('resets consecutive passes after a legal move follows a pass', () => {
    const game = createGame();

    const afterPass = pass(game);
    expect(afterPass.consecutivePasses).toBe(1);

    const afterMove = playMove(afterPass, point(4, 4));

    expect(afterMove.consecutivePasses).toBe(0);
    expect(afterMove.phase).toBe('play');
  });

  it('does not mutate the prior state on a legal move', () => {
    const game = createGame();
    const before = snapshot(game);

    const next = playMove(game, point(4, 4));

    expect(next).not.toBe(game);
    expect([...game.board]).toEqual(before.board);
    expect(getStone(game.board, 4, 4)).toBeNull();
    expect(game.currentPlayer).toBe(before.currentPlayer);
    expect(game.phase).toBe(before.phase);
    expect(game.consecutivePasses).toBe(before.consecutivePasses);
    expect(new Set(game.seenBoardKeys)).toEqual(before.seenBoardKeys);
  });

  it('rejects a move on an occupied point without changing the game', () => {
    const game = playMove(createGame(), point(4, 4));
    const before = snapshot(game);

    const rejected = playMove(game, point(4, 4));

    expect([...rejected.board]).toEqual(before.board);
    expect(rejected.currentPlayer).toBe(before.currentPlayer);
    expect(rejected.phase).toBe(before.phase);
    expect(rejected.consecutivePasses).toBe(before.consecutivePasses);
    expect(new Set(rejected.seenBoardKeys)).toEqual(before.seenBoardKeys);
  });

  it('exposes a UI-readable reason for an occupied-point rejection', () => {
    const game = playMove(createGame(), point(4, 4));

    const rejected = playMove(game, point(4, 4));

    expect(rejected.lastMoveRejection).toBe('occupied');
  });

  it('clears the rejection reason after a subsequent legal move', () => {
    const game = playMove(createGame(), point(4, 4));
    const rejected = playMove(game, point(4, 4));

    const recovered = playMove(rejected, point(2, 2));

    expect(recovered.lastMoveRejection).toBeNull();
    expect(getStone(recovered.board, 2, 2)).toBe('white');
  });

  it('rejects an immediate ko recapture as a repeat position', () => {
    // Build a real ko through alternating legal moves:
    //   . B W .
    //   B . B W   <- black (2,3) has its only liberty at (2,2)
    //   . B W .
    let game = createGame();
    game = playMove(game, point(1, 2)); // black
    game = playMove(game, point(1, 3)); // white
    game = playMove(game, point(2, 1)); // black
    game = playMove(game, point(2, 4)); // white
    game = playMove(game, point(3, 2)); // black
    game = playMove(game, point(3, 3)); // white
    game = playMove(game, point(2, 3)); // black takes the ko point
    expect(game.lastMoveRejection).toBeNull();

    const beforeKoCapture = game;

    // White captures the ko: the stone at (2,2) removes black (2,3).
    const afterKoCapture = playMove(game, point(2, 2));

    expect(getStone(afterKoCapture.board, 2, 2)).toBe('white');
    expect(getStone(afterKoCapture.board, 2, 3)).toBeNull();
    // The pre-capture position was recorded in the history handed to the
    // Task 4 legality check, so recreating it must be detectable.
    expect(
      afterKoCapture.seenBoardKeys.has(boardKey(beforeKoCapture.board)),
    ).toBe(true);

    // Black's immediate recapture would recreate that exact position.
    const recapture = playMove(afterKoCapture, point(2, 3));

    expect(recapture.lastMoveRejection).toBe('repeat-position');
    expect([...recapture.board]).toEqual([...afterKoCapture.board]);
    expect(getStone(recapture.board, 2, 2)).toBe('white');
    expect(recapture.currentPlayer).toBe('black');
  });

  it('cannot change the board outside the play phase', () => {
    const markDead = pass(pass(createGame()));
    expect(markDead.phase).toBe('mark-dead');

    const before = snapshot(markDead);

    const attempted = playMove(markDead, point(4, 4));

    expect([...attempted.board]).toEqual(before.board);
    expect(getStone(attempted.board, 4, 4)).toBeNull();
    expect(attempted.phase).toBe('mark-dead');
    expect(attempted.currentPlayer).toBe(before.currentPlayer);
    expect(attempted.consecutivePasses).toBe(before.consecutivePasses);
  });
});

describe('pass', () => {
  it('transfers the turn and records one consecutive pass', () => {
    const game = createGame();

    const afterPass = pass(game);

    expect(afterPass.currentPlayer).toBe('white');
    expect(afterPass.consecutivePasses).toBe(1);
    expect(afterPass.phase).toBe('play');
    expect([...afterPass.board]).toEqual([...game.board]);
  });

  it('does not add a position to the history', () => {
    // Only successful stone placements enter the repeat-detection history.
    const game = createGame();

    const afterPass = pass(game);

    expect(new Set(afterPass.seenBoardKeys)).toEqual(
      new Set(game.seenBoardKeys),
    );
  });

  it('does not mutate the prior state', () => {
    const game = createGame();
    const before = snapshot(game);

    const next = pass(game);

    expect(next).not.toBe(game);
    expect(game.currentPlayer).toBe(before.currentPlayer);
    expect(game.consecutivePasses).toBe(before.consecutivePasses);
    expect(game.phase).toBe(before.phase);
  });

  it('moves the game to mark-dead after two consecutive passes', () => {
    const game = createGame();

    const afterTwoPasses = pass(pass(game));

    expect(afterTwoPasses.phase).toBe('mark-dead');
    expect(afterTwoPasses.consecutivePasses).toBe(2);
  });

  it('counts only consecutive passes when a move intervenes', () => {
    const game = createGame();

    const interrupted = pass(playMove(pass(game), point(4, 4)));

    expect(interrupted.consecutivePasses).toBe(1);
    expect(interrupted.phase).toBe('play');
  });

  it('clears the rejection reason after a subsequent legal pass', () => {
    // Passing is a legal action, so stale move feedback must not survive
    // it — the UI would otherwise keep showing an error after a valid turn.
    const game = playMove(createGame(), point(4, 4));
    const rejected = playMove(game, point(4, 4));
    expect(rejected.lastMoveRejection).toBe('occupied');

    const afterPass = pass(rejected);

    expect(afterPass.lastMoveRejection).toBeNull();
    expect(afterPass.currentPlayer).toBe('black');
    expect(afterPass.consecutivePasses).toBe(1);
  });

  it('cannot advance a non-play phase', () => {
    const markDead = pass(pass(createGame()));
    expect(markDead.phase).toBe('mark-dead');

    const before = snapshot(markDead);

    const attempted = pass(markDead);

    expect(attempted.phase).toBe('mark-dead');
    expect(attempted.currentPlayer).toBe(before.currentPlayer);
    expect(attempted.consecutivePasses).toBe(before.consecutivePasses);
    expect([...attempted.board]).toEqual(before.board);
  });
});

describe('toggleDeadGroup', () => {
  it('marks every stone of the clicked group as dead in mark-dead', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));

    expect(new Set(marked.deadPoints)).toEqual(
      new Set([pointToIndex(4, 4), pointToIndex(4, 5)]),
    );
  });

  it('leaves other groups unmarked when one group is toggled', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));

    expect(marked.deadPoints.has(pointToIndex(2, 2))).toBe(false);
    expect(marked.deadPoints.has(pointToIndex(2, 3))).toBe(false);
  });

  it('unmarks the whole group on a second click anywhere on it', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));
    // The second click lands on the *other* stone of the same group: the
    // toggle applies to the connected group, not the clicked point alone.
    const unmarked = toggleDeadGroup(marked, point(4, 5));

    expect(new Set(unmarked.deadPoints)).toEqual(new Set());
  });

  it('toggles groups independently of each other', () => {
    const game = markDeadGame();

    const bothMarked = toggleDeadGroup(
      toggleDeadGroup(game, point(4, 4)),
      point(2, 2),
    );

    expect(new Set(bothMarked.deadPoints)).toEqual(
      new Set([
        pointToIndex(4, 4),
        pointToIndex(4, 5),
        pointToIndex(2, 2),
        pointToIndex(2, 3),
      ]),
    );

    const whiteUnmarked = toggleDeadGroup(bothMarked, point(2, 3));

    expect(new Set(whiteUnmarked.deadPoints)).toEqual(
      new Set([pointToIndex(4, 4), pointToIndex(4, 5)]),
    );
  });

  it('keeps marked stones on the game board and in the history', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));

    // Dead marking is bookkeeping for the score only: the stones stay on
    // the board and the position history is untouched.
    expect(getStone(marked.board, 4, 4)).toBe('black');
    expect(getStone(marked.board, 4, 5)).toBe('black');
    expect([...marked.board]).toEqual([...game.board]);
    expect(new Set(marked.seenBoardKeys)).toEqual(
      new Set(game.seenBoardKeys),
    );
  });

  it('removes marked stones only inside the score calculation', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));

    // With the black pair dead, every empty point touches only white:
    // white owns its 2 stones plus 79 territory points, black nothing.
    const result = scoreArea(marked.board, marked.deadPoints);

    expect(result.black).toBe(0);
    expect(result.white).toBe(81);
    // ...while the original stones are still physically on the board.
    expect(getStone(marked.board, 4, 4)).toBe('black');
    expect(getStone(marked.board, 4, 5)).toBe('black');
  });

  it('ignores clicks on empty intersections', () => {
    const game = markDeadGame();

    const attempted = toggleDeadGroup(game, point(0, 0));

    expect(new Set(attempted.deadPoints)).toEqual(new Set());
    expect([...attempted.board]).toEqual([...game.board]);
    expect(attempted.phase).toBe('mark-dead');
  });

  it('does not mutate the prior state', () => {
    const game = markDeadGame();

    const marked = toggleDeadGroup(game, point(4, 4));

    expect(marked).not.toBe(game);
    expect(new Set(game.deadPoints)).toEqual(new Set());
  });

  it('changes nothing during the play phase', () => {
    const game = playMove(createGame(), point(4, 4));
    expect(game.phase).toBe('play');

    const attempted = toggleDeadGroup(game, point(4, 4));

    expect(attempted).toEqual(game);
    expect(new Set(attempted.deadPoints)).toEqual(new Set());
  });

  it('changes nothing after scoring is confirmed', () => {
    const finished = confirmScoring(markDeadGame());
    expect(finished.phase).toBe('finished');

    const attempted = toggleDeadGroup(finished, point(4, 4));

    expect(attempted).toEqual(finished);
    expect(new Set(attempted.deadPoints)).toEqual(
      new Set(finished.deadPoints),
    );
  });
});

describe('confirmScoring', () => {
  it('moves mark-dead to finished', () => {
    const game = markDeadGame();

    const finished = confirmScoring(game);

    expect(finished.phase).toBe('finished');
  });

  it('keeps the board and dead markings unchanged', () => {
    const game = toggleDeadGroup(markDeadGame(), point(2, 2));

    const finished = confirmScoring(game);

    expect([...finished.board]).toEqual([...game.board]);
    expect(new Set(finished.deadPoints)).toEqual(new Set(game.deadPoints));
    expect(new Set(finished.seenBoardKeys)).toEqual(
      new Set(game.seenBoardKeys),
    );
    expect(finished.currentPlayer).toBe(game.currentPlayer);
  });

  it('does not mutate the prior state', () => {
    const game = markDeadGame();

    const finished = confirmScoring(game);

    expect(finished).not.toBe(game);
    expect(game.phase).toBe('mark-dead');
  });

  it('does not advance the play phase', () => {
    const game = playMove(createGame(), point(4, 4));

    const attempted = confirmScoring(game);

    expect(attempted.phase).toBe('play');
    expect(attempted).toEqual(game);
  });

  it('leaves an already finished game unchanged', () => {
    const finished = confirmScoring(markDeadGame());

    const again = confirmScoring(finished);

    expect(again.phase).toBe('finished');
    expect(again).toEqual(finished);
  });
});
