import { describe, expect, it } from 'vitest';

import { createEmptyBoard, pointToIndex, setStone } from '../src/domain/board';
import { scoreArea } from '../src/domain/scoring';
import { BOARD_SIZE, type Board, type Player } from '../src/domain/types';

type Placement = readonly [row: number, column: number, stone: Player];

const buildBoard = (placements: readonly Placement[]): Board =>
  placements.reduce<Board>(
    (board, [row, column, stone]) => setStone(board, row, column, stone),
    createEmptyBoard(),
  );

/** A full vertical wall: the simplest region boundary on a 9×9 board. */
const columnWall = (column: number, stone: Player): Placement[] =>
  Array.from(
    { length: BOARD_SIZE },
    (_, row): Placement => [row, column, stone],
  );

const NO_DEAD: ReadonlySet<number> = new Set();

describe('scoreArea', () => {
  it('always reports the exact 7.5 white komi', () => {
    const result = scoreArea(createEmptyBoard(), NO_DEAD);

    expect(result.whiteKomi).toBe(7.5);
  });

  it('scores empty regions bounded exclusively by black for black', () => {
    // A black wall on column 4 splits the empty points into two regions
    // (36 + 36); each touches only black, so black owns stones + all
    // territory: 9 + 72 = 81.
    const board = buildBoard(columnWall(4, 'black'));

    const result = scoreArea(board, NO_DEAD);

    expect(result.black).toBe(81);
    expect(result.white).toBe(0);
    expect(result.winner).toBe('black');
  });

  it('scores empty regions bounded exclusively by white for white', () => {
    const board = buildBoard(columnWall(4, 'white'));

    const result = scoreArea(board, NO_DEAD);

    expect(result.white).toBe(81);
    expect(result.black).toBe(0);
    expect(result.winner).toBe('white');
  });

  it('gives a region touching both colors to no one', () => {
    // Black wall on column 2, white wall on column 6:
    //   columns 0–1 (18) touch only black, columns 7–8 (18) touch only
    //   white, and the middle columns 3–5 (27) touch both walls, so those
    //   27 points are neutral and appear in neither score.
    const board = buildBoard([
      ...columnWall(2, 'black'),
      ...columnWall(6, 'white'),
    ]);

    const result = scoreArea(board, NO_DEAD);

    expect(result.black).toBe(27);
    expect(result.white).toBe(27);
    expect(result.black + result.white).toBeLessThan(
      BOARD_SIZE * BOARD_SIZE,
    );
  });

  it('decides the winner only after adding komi to white', () => {
    // Equal 27–27 areas: komi turns the tie into a white win. A draw is
    // impossible under the fixed 7.5 komi because areas are integers.
    const board = buildBoard([
      ...columnWall(2, 'black'),
      ...columnWall(6, 'white'),
    ]);

    const result = scoreArea(board, NO_DEAD);

    expect(result.black).toBe(result.white);
    expect(result.winner).toBe('white');
  });

  it('names black the winner when black leads by more than the komi', () => {
    // Black wall on column 5 owns columns 0–4: black 9 + 45 = 54.
    // White wall on column 7 owns column 8: white 9 + 9 = 18.
    // Column 6 touches both walls and stays neutral. 54 > 18 + 7.5.
    const board = buildBoard([
      ...columnWall(5, 'black'),
      ...columnWall(7, 'white'),
    ]);

    const result = scoreArea(board, NO_DEAD);

    expect(result.black).toBe(54);
    expect(result.white).toBe(18);
    expect(result.winner).toBe('black');
  });

  it('treats the fully empty board as all neutral, so komi decides', () => {
    const result = scoreArea(createEmptyBoard(), NO_DEAD);

    expect(result.black).toBe(0);
    expect(result.white).toBe(0);
    expect(result.winner).toBe('white');
  });

  it('keeps an unmarked lone stone alive, leaving its region neutral', () => {
    // A live white stone at (4, 0) sits inside black's would-be territory,
    // so the whole left region touches both colors and scores for no one.
    const board = buildBoard([
      ...columnWall(2, 'black'),
      ...columnWall(6, 'white'),
      [4, 0, 'white'],
    ]);

    const result = scoreArea(board, NO_DEAD);

    expect(result.black).toBe(9);
    expect(result.white).toBe(28);
  });

  it('removes marked dead stones for the calculation only', () => {
    // The same position, but the invading white stone is marked dead: it
    // vanishes from the calculation and its point becomes black territory,
    // restoring black's 9 + 18 = 27 without touching the input board.
    const board = buildBoard([
      ...columnWall(2, 'black'),
      ...columnWall(6, 'white'),
      [4, 0, 'white'],
    ]);
    const deadPoints: ReadonlySet<number> = new Set([pointToIndex(4, 0)]);

    const result = scoreArea(board, deadPoints);

    expect(result.black).toBe(27);
    expect(result.white).toBe(27);
  });

  it('does not mutate the board it scores', () => {
    const board = buildBoard([
      ...columnWall(2, 'black'),
      [4, 0, 'white'],
    ]);
    const before = [...board];

    scoreArea(board, new Set([pointToIndex(4, 0)]));

    expect([...board]).toEqual(before);
  });
});
