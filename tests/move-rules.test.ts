import { describe, expect, it } from 'vitest';

import { createEmptyBoard, getStone, setStone } from '../src/domain/board';
import type { Board, Player } from '../src/domain/types';
import { boardKey, tryPlayMove } from '../src/domain/rules';

type Placement = readonly [row: number, column: number, stone: Player];

const buildBoard = (placements: readonly Placement[]): Board =>
  placements.reduce<Board>(
    (board, [row, column, stone]) => setStone(board, row, column, stone),
    createEmptyBoard(),
  );

const noSeenPositions: ReadonlySet<string> = new Set<string>();

describe('boardKey', () => {
  it('gives the same key for the same full board position', () => {
    const first = buildBoard([
      [2, 2, 'black'],
      [6, 6, 'white'],
    ]);
    const second = buildBoard([
      [6, 6, 'white'],
      [2, 2, 'black'],
    ]);

    expect(boardKey(first)).toBe(boardKey(second));
  });

  it('gives different keys when any intersection differs', () => {
    const empty = createEmptyBoard();
    const withStone = buildBoard([[4, 4, 'black']]);

    expect(boardKey(withStone)).not.toBe(boardKey(empty));
  });

  it('distinguishes stone colors at the same intersection', () => {
    const black = buildBoard([[4, 4, 'black']]);
    const white = buildBoard([[4, 4, 'white']]);

    expect(boardKey(black)).not.toBe(boardKey(white));
  });

  it('depends only on the board, not on any player-to-move context', () => {
    // Chinese-rules repeat detection compares full board positions only,
    // so the key is a pure function of the board contents.
    const board = buildBoard([
      [0, 0, 'black'],
      [8, 8, 'white'],
    ]);

    expect(boardKey(board)).toBe(boardKey([...board]));
  });
});

describe('tryPlayMove', () => {
  it('rejects a move on an occupied intersection', () => {
    const board = buildBoard([[4, 4, 'black']]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 4 },
      'white',
      noSeenPositions,
    );

    expect(result).toEqual({ ok: false, reason: 'occupied' });
  });

  it('rejects an occupied intersection even for the same color', () => {
    const board = buildBoard([[4, 4, 'black']]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 4 },
      'black',
      noSeenPositions,
    );

    expect(result).toEqual({ ok: false, reason: 'occupied' });
  });

  it('rejects a single-stone suicide that captures nothing', () => {
    // (4, 4) is empty and completely surrounded by live black stones.
    const board = buildBoard([
      [3, 4, 'black'],
      [5, 4, 'black'],
      [4, 3, 'black'],
      [4, 5, 'black'],
    ]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 4 },
      'white',
      noSeenPositions,
    );

    expect(result).toEqual({ ok: false, reason: 'suicide' });
  });

  it('rejects a suicide that joins a friendly group into zero liberties', () => {
    // White (0, 0) would connect to white (0, 1); the joined pair has no
    // liberties and no black group is captured.
    const board = buildBoard([
      [0, 1, 'white'],
      [0, 2, 'black'],
      [1, 0, 'black'],
      [1, 1, 'black'],
    ]);

    const result = tryPlayMove(
      board,
      { row: 0, column: 0 },
      'white',
      noSeenPositions,
    );

    expect(result).toEqual({ ok: false, reason: 'suicide' });
  });

  it('allows a self-atari move that keeps exactly one liberty', () => {
    // Black (0, 0) next to white (0, 1) keeps a single liberty at (1, 0).
    const board = buildBoard([[0, 1, 'white']]);

    const result = tryPlayMove(
      board,
      { row: 0, column: 0 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(getStone(result.board, 0, 0)).toBe('black');
      expect(getStone(result.board, 0, 1)).toBe('white');
    }
  });

  it('allows a would-be suicide that captures an adjacent opponent group', () => {
    // Every neighbor of (4, 4) is white, but the white stone at (3, 4) has
    // (4, 4) as its last liberty, so black's move captures it first.
    const board = buildBoard([
      [3, 4, 'white'],
      [2, 4, 'black'],
      [3, 3, 'black'],
      [3, 5, 'black'],
      [4, 3, 'white'],
      [4, 5, 'white'],
      [5, 4, 'white'],
    ]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 4 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      // The captured white stone is removed and the move stone stands.
      expect(getStone(result.board, 3, 4)).toBeNull();
      expect(getStone(result.board, 4, 4)).toBe('black');

      // Uncaptured white neighbors keep their stones.
      expect(getStone(result.board, 4, 3)).toBe('white');
      expect(getStone(result.board, 4, 5)).toBe('white');
      expect(getStone(result.board, 5, 4)).toBe('white');
    }
  });

  it('captures an adjacent two-stone opponent group', () => {
    // The white pair (4, 4)-(4, 5) has (4, 6) as its last liberty; black's
    // move there removes both stones at once.
    const board = buildBoard([
      [4, 4, 'white'],
      [4, 5, 'white'],
      [3, 4, 'black'],
      [3, 5, 'black'],
      [5, 4, 'black'],
      [5, 5, 'black'],
      [4, 3, 'black'],
    ]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 6 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      // The whole captured group is removed and the move stone stands.
      expect(getStone(result.board, 4, 4)).toBeNull();
      expect(getStone(result.board, 4, 5)).toBeNull();
      expect(getStone(result.board, 4, 6)).toBe('black');
    }
  });

  it('captures two separate opponent groups with a single move', () => {
    // The white stones at (4, 3) and (4, 5) are unconnected groups that
    // share (4, 4) as their last liberty; black's move there captures both.
    const board = buildBoard([
      [4, 3, 'white'],
      [4, 5, 'white'],
      [3, 3, 'black'],
      [5, 3, 'black'],
      [4, 2, 'black'],
      [3, 5, 'black'],
      [5, 5, 'black'],
      [4, 6, 'black'],
    ]);

    const result = tryPlayMove(
      board,
      { row: 4, column: 4 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      // Both captured groups are removed and the move stone stands.
      expect(getStone(result.board, 4, 3)).toBeNull();
      expect(getStone(result.board, 4, 5)).toBeNull();
      expect(getStone(result.board, 4, 4)).toBe('black');

      // Surrounding black stones are untouched.
      expect(getStone(result.board, 4, 2)).toBe('black');
      expect(getStone(result.board, 4, 6)).toBe('black');
    }
  });

  it('rejects a ko recapture that recreates a prior full board position', () => {
    // Classic ko: the white stone at (4, 3) is in atari with its last
    // liberty at (4, 4); black stones surround (4, 3), white stones
    // surround (4, 4).
    const koBoard = buildBoard([
      [4, 3, 'white'],
      [3, 3, 'black'],
      [5, 3, 'black'],
      [4, 2, 'black'],
      [3, 4, 'white'],
      [5, 4, 'white'],
      [4, 5, 'white'],
    ]);

    const seen = new Set<string>([boardKey(koBoard)]);

    const capture = tryPlayMove(
      koBoard,
      { row: 4, column: 4 },
      'black',
      seen,
    );

    expect(capture.ok).toBe(true);

    if (capture.ok) {
      seen.add(capture.boardKey);

      // White's immediate recapture at (4, 3) would restore the original
      // full board position and must be rejected.
      const recapture = tryPlayMove(
        capture.board,
        { row: 4, column: 3 },
        'white',
        seen,
      );

      expect(recapture).toEqual({ ok: false, reason: 'repeat-position' });
    }
  });

  it('rejects a move whose resulting position is already in seenBoardKeys', () => {
    const board = createEmptyBoard();
    const resulting = setStone(board, 4, 4, 'black');
    const seen = new Set<string>([boardKey(resulting)]);

    const result = tryPlayMove(board, { row: 4, column: 4 }, 'black', seen);

    expect(result).toEqual({ ok: false, reason: 'repeat-position' });
  });

  it('checks repetition against the position after captures, not before', () => {
    // Black captures white (4, 4); the post-capture position is new even
    // though the pre-capture placement alone would look different.
    const board = buildBoard([
      [4, 4, 'white'],
      [3, 4, 'black'],
      [5, 4, 'black'],
      [4, 3, 'black'],
    ]);

    const afterCapture = setStone(
      setStone(board, 4, 5, 'black'),
      4,
      4,
      null,
    );
    const seen = new Set<string>([boardKey(afterCapture)]);

    const result = tryPlayMove(board, { row: 4, column: 5 }, 'black', seen);

    expect(result).toEqual({ ok: false, reason: 'repeat-position' });
  });

  it('returns a new resulting board and leaves the input board untouched', () => {
    const original = createEmptyBoard();

    const result = tryPlayMove(
      original,
      { row: 2, column: 6 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.board).not.toBe(original);
      expect(getStone(result.board, 2, 6)).toBe('black');
      expect(getStone(original, 2, 6)).toBeNull();
      expect(original.every((stone) => stone === null)).toBe(true);
    }
  });

  it('returns the boardKey of the resulting board on success', () => {
    const board = buildBoard([[3, 3, 'white']]);

    const result = tryPlayMove(
      board,
      { row: 5, column: 5 },
      'black',
      noSeenPositions,
    );

    expect(result.ok).toBe(true);

    if (result.ok) {
      expect(result.boardKey).toBe(boardKey(result.board));
      expect(result.boardKey).toBe(
        boardKey(
          buildBoard([
            [3, 3, 'white'],
            [5, 5, 'black'],
          ]),
        ),
      );
    }
  });
});
