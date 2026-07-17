import { describe, expect, it } from 'vitest';

import { createEmptyBoard, getStone, setStone } from '../src/domain/board';
import type { Board, Player, Point } from '../src/domain/types';
import {
  collectGroup,
  countLiberties,
  removeCapturedOpponentGroups,
} from '../src/domain/rules';

type Placement = readonly [row: number, column: number, stone: Player];

const buildBoard = (placements: readonly Placement[]): Board =>
  placements.reduce<Board>(
    (board, [row, column, stone]) => setStone(board, row, column, stone),
    createEmptyBoard(),
  );

const sorted = (points: ReadonlyArray<Point>): Point[] =>
  [...points].sort((a, b) => a.row - b.row || a.column - b.column);

describe('collectGroup', () => {
  it('returns only the stone itself for a lone stone', () => {
    const board = buildBoard([[4, 4, 'black']]);

    expect(sorted(collectGroup(board, 4, 4))).toEqual([{ row: 4, column: 4 }]);
  });

  it('collects every orthogonally connected stone of the same color', () => {
    const board = buildBoard([
      [2, 2, 'black'],
      [2, 3, 'black'],
      [2, 4, 'black'],
      [3, 2, 'black'],
    ]);

    expect(sorted(collectGroup(board, 2, 3))).toEqual([
      { row: 2, column: 2 },
      { row: 2, column: 3 },
      { row: 2, column: 4 },
      { row: 3, column: 2 },
    ]);
  });

  it('does not connect stones that only touch diagonally', () => {
    const board = buildBoard([
      [2, 2, 'black'],
      [3, 3, 'black'],
    ]);

    expect(sorted(collectGroup(board, 2, 2))).toEqual([{ row: 2, column: 2 }]);
  });

  it('does not connect same-color stones through an opponent stone', () => {
    const board = buildBoard([
      [4, 3, 'black'],
      [4, 4, 'white'],
      [4, 5, 'black'],
    ]);

    expect(sorted(collectGroup(board, 4, 3))).toEqual([{ row: 4, column: 3 }]);
  });
});

describe('countLiberties', () => {
  it('gives a lone interior stone four liberties', () => {
    const board = buildBoard([[4, 4, 'black']]);

    expect(countLiberties(board, collectGroup(board, 4, 4))).toBe(4);
  });

  it('counts a liberty shared by two group stones only once', () => {
    // L-shaped group: (5, 5) touches both (4, 5) and (5, 4).
    const board = buildBoard([
      [4, 4, 'black'],
      [4, 5, 'black'],
      [5, 4, 'black'],
    ]);

    expect(countLiberties(board, collectGroup(board, 4, 4))).toBe(7);
  });

  it('excludes intersections occupied by the opponent', () => {
    const board = buildBoard([
      [0, 0, 'black'],
      [0, 1, 'white'],
    ]);

    expect(countLiberties(board, collectGroup(board, 0, 0))).toBe(1);
  });

  it('returns zero for a fully surrounded stone', () => {
    const board = buildBoard([
      [4, 4, 'white'],
      [3, 4, 'black'],
      [5, 4, 'black'],
      [4, 3, 'black'],
      [4, 5, 'black'],
    ]);

    expect(countLiberties(board, collectGroup(board, 4, 4))).toBe(0);
  });
});

describe('removeCapturedOpponentGroups', () => {
  it('removes a single opponent stone whose last liberty was just filled', () => {
    const board = buildBoard([
      [4, 4, 'white'],
      [3, 4, 'black'],
      [5, 4, 'black'],
      [4, 3, 'black'],
      [4, 5, 'black'],
    ]);

    const result = removeCapturedOpponentGroups(
      board,
      { row: 4, column: 5 },
      'black',
    );

    expect(getStone(result, 4, 4)).toBeNull();
    expect(getStone(result, 3, 4)).toBe('black');
    expect(getStone(result, 5, 4)).toBe('black');
    expect(getStone(result, 4, 3)).toBe('black');
    expect(getStone(result, 4, 5)).toBe('black');
  });

  it('removes an entire multi-stone opponent group at once', () => {
    const board = buildBoard([
      [4, 4, 'white'],
      [4, 5, 'white'],
      [3, 4, 'black'],
      [3, 5, 'black'],
      [5, 4, 'black'],
      [5, 5, 'black'],
      [4, 3, 'black'],
      [4, 6, 'black'],
    ]);

    const result = removeCapturedOpponentGroups(
      board,
      { row: 4, column: 6 },
      'black',
    );

    expect(getStone(result, 4, 4)).toBeNull();
    expect(getStone(result, 4, 5)).toBeNull();
    expect(getStone(result, 3, 4)).toBe('black');
    expect(getStone(result, 3, 5)).toBe('black');
    expect(getStone(result, 5, 4)).toBe('black');
    expect(getStone(result, 5, 5)).toBe('black');
    expect(getStone(result, 4, 3)).toBe('black');
    expect(getStone(result, 4, 6)).toBe('black');
  });

  it('removes nothing while the adjacent opponent group keeps a liberty', () => {
    // White pair keeps one liberty at (4, 6) after black plays (4, 3).
    const board = buildBoard([
      [4, 4, 'white'],
      [4, 5, 'white'],
      [3, 4, 'black'],
      [3, 5, 'black'],
      [5, 4, 'black'],
      [5, 5, 'black'],
      [4, 3, 'black'],
    ]);

    const result = removeCapturedOpponentGroups(
      board,
      { row: 4, column: 3 },
      'black',
    );

    expect(getStone(result, 4, 4)).toBe('white');
    expect(getStone(result, 4, 5)).toBe('white');
    expect(result).toEqual(board);
  });

  it('removes two separate opponent groups captured by the same move', () => {
    // White stones at (4, 3) and (4, 5) form two separate groups whose
    // shared last liberty is (4, 4); black's move there captures both.
    const board = buildBoard([
      [4, 3, 'white'],
      [4, 5, 'white'],
      [3, 3, 'black'],
      [5, 3, 'black'],
      [4, 2, 'black'],
      [3, 5, 'black'],
      [5, 5, 'black'],
      [4, 6, 'black'],
      [4, 4, 'black'],
    ]);

    // Sanity check: the two white stones are not one connected group.
    expect(sorted(collectGroup(board, 4, 3))).toEqual([{ row: 4, column: 3 }]);
    expect(sorted(collectGroup(board, 4, 5))).toEqual([{ row: 4, column: 5 }]);

    const result = removeCapturedOpponentGroups(
      board,
      { row: 4, column: 4 },
      'black',
    );

    expect(getStone(result, 4, 3)).toBeNull();
    expect(getStone(result, 4, 5)).toBeNull();
    expect(getStone(result, 4, 4)).toBe('black');
    expect(getStone(result, 3, 3)).toBe('black');
    expect(getStone(result, 5, 3)).toBe('black');
    expect(getStone(result, 4, 2)).toBe('black');
    expect(getStone(result, 3, 5)).toBe('black');
    expect(getStone(result, 5, 5)).toBe('black');
    expect(getStone(result, 4, 6)).toBe('black');
  });

  it('captures next to a move that also joins friendly groups', () => {
    // Before the move at (0, 1), black holds two separate groups:
    // {(1, 0), (1, 1)} and {(0, 2)}. The move joins them and fills the
    // last liberty of the white corner stone at (0, 0).
    const board = buildBoard([
      [0, 0, 'white'],
      [1, 0, 'black'],
      [1, 1, 'black'],
      [0, 2, 'black'],
      [0, 1, 'black'],
    ]);

    const result = removeCapturedOpponentGroups(
      board,
      { row: 0, column: 1 },
      'black',
    );

    expect(getStone(result, 0, 0)).toBeNull();

    const joined = collectGroup(result, 0, 1);
    expect(sorted(joined)).toEqual([
      { row: 0, column: 1 },
      { row: 0, column: 2 },
      { row: 1, column: 0 },
      { row: 1, column: 1 },
    ]);

    // The freed corner point now counts among the joined group's liberties:
    // (0, 0), (0, 3), (1, 2), (2, 0), (2, 1).
    expect(countLiberties(result, joined)).toBe(5);
  });
});
