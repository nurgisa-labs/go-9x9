import { getStone, orthogonalNeighbors, setStone } from './board';
import type { Board, Player, Point } from './types';

const pointKey = (row: number, column: number): string => `${row},${column}`;

export function collectGroup(
  board: Board,
  row: number,
  column: number,
): Point[] {
  const color = getStone(board, row, column);

  if (color === null) {
    return [];
  }

  const visited = new Set<string>([pointKey(row, column)]);
  const group: Point[] = [];
  const stack: Point[] = [{ row, column }];

  while (stack.length > 0) {
    const point = stack.pop() as Point;
    group.push(point);

    for (const neighbor of orthogonalNeighbors(point.row, point.column)) {
      const key = pointKey(neighbor.row, neighbor.column);

      if (
        !visited.has(key) &&
        getStone(board, neighbor.row, neighbor.column) === color
      ) {
        visited.add(key);
        stack.push(neighbor);
      }
    }
  }

  return group;
}

export function countLiberties(
  board: Board,
  group: ReadonlyArray<Point>,
): number {
  const liberties = new Set<string>();

  for (const point of group) {
    for (const neighbor of orthogonalNeighbors(point.row, point.column)) {
      if (getStone(board, neighbor.row, neighbor.column) === null) {
        liberties.add(pointKey(neighbor.row, neighbor.column));
      }
    }
  }

  return liberties.size;
}

const STONE_KEY_CHARS: Record<Player, string> = {
  black: 'b',
  white: 'w',
};

/**
 * Chinese-rules repeat detection compares full board positions only, so the
 * key depends solely on the board contents, never on the player to move.
 */
export function boardKey(board: Board): string {
  return board
    .map((stone) => (stone === null ? '.' : STONE_KEY_CHARS[stone]))
    .join('');
}

export type MoveResult =
  | { readonly ok: true; readonly board: Board; readonly boardKey: string }
  | {
      readonly ok: false;
      readonly reason: 'occupied' | 'suicide' | 'repeat-position';
    };

/**
 * Attempts to play `player`'s stone at `move`, applying captures and the
 * occupied/suicide/repeat-position legality checks.
 *
 * `move` must be an in-bounds board point; out-of-range coordinates throw a
 * `RangeError` rather than producing a result. `seenBoardKeys` holds the keys
 * of prior full board positions; callers add the returned `boardKey` to it
 * after each successful move so repeat detection stays complete.
 */
export function tryPlayMove(
  board: Board,
  move: Point,
  player: Player,
  seenBoardKeys: ReadonlySet<string>,
): MoveResult {
  if (getStone(board, move.row, move.column) !== null) {
    return { ok: false, reason: 'occupied' };
  }

  const placed = setStone(board, move.row, move.column, player);
  const afterCaptures = removeCapturedOpponentGroups(placed, move, player);

  const ownGroup = collectGroup(afterCaptures, move.row, move.column);

  if (countLiberties(afterCaptures, ownGroup) === 0) {
    return { ok: false, reason: 'suicide' };
  }

  const key = boardKey(afterCaptures);

  if (seenBoardKeys.has(key)) {
    return { ok: false, reason: 'repeat-position' };
  }

  return { ok: true, board: afterCaptures, boardKey: key };
}

/**
 * Precondition: `board` already includes the player's stone at `move`.
 */
export function removeCapturedOpponentGroups(
  board: Board,
  move: Point,
  player: Player,
): Board {
  let next = board;

  for (const neighbor of orthogonalNeighbors(move.row, move.column)) {
    const stone = getStone(next, neighbor.row, neighbor.column);

    if (stone === null || stone === player) {
      continue;
    }

    const group = collectGroup(next, neighbor.row, neighbor.column);

    if (countLiberties(next, group) === 0) {
      next = group.reduce<Board>(
        (cleared, point) => setStone(cleared, point.row, point.column, null),
        next,
      );
    }
  }

  return next;
}
