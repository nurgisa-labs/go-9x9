import { createEmptyBoard, getStone, pointToIndex } from './board';
import { boardKey, collectGroup, tryPlayMove } from './rules';
import type { MoveResult } from './rules';
import type { Board, Player, Point } from './types';

export type GamePhase = 'play' | 'mark-dead' | 'finished';

export type GameState = {
  readonly board: Board;
  readonly currentPlayer: Player;
  readonly phase: GamePhase;
  readonly consecutivePasses: number;
  readonly seenBoardKeys: ReadonlySet<string>;
  /** Board indices of stones marked dead during the mark-dead phase. */
  readonly deadPoints: ReadonlySet<number>;
  /** Why the most recent move attempt was rejected; null after a legal move. */
  readonly lastMoveRejection: Extract<MoveResult, { ok: false }>['reason'] | null;
};

const opponent = (player: Player): Player =>
  player === 'black' ? 'white' : 'black';

export function createGame(): GameState {
  const board = createEmptyBoard();

  return {
    board,
    currentPlayer: 'black',
    phase: 'play',
    consecutivePasses: 0,
    seenBoardKeys: new Set([boardKey(board)]),
    deadPoints: new Set(),
    lastMoveRejection: null,
  };
}

export function playMove(state: GameState, move: Point): GameState {
  if (state.phase !== 'play') {
    return state;
  }

  const result = tryPlayMove(
    state.board,
    move,
    state.currentPlayer,
    state.seenBoardKeys,
  );

  if (!result.ok) {
    return { ...state, lastMoveRejection: result.reason };
  }

  return {
    ...state,
    board: result.board,
    currentPlayer: opponent(state.currentPlayer),
    consecutivePasses: 0,
    seenBoardKeys: new Set(state.seenBoardKeys).add(result.boardKey),
    lastMoveRejection: null,
  };
}

export function pass(state: GameState): GameState {
  if (state.phase !== 'play') {
    return state;
  }

  const consecutivePasses = state.consecutivePasses + 1;

  return {
    ...state,
    currentPlayer: opponent(state.currentPlayer),
    consecutivePasses,
    phase: consecutivePasses >= 2 ? 'mark-dead' : 'play',
    lastMoveRejection: null,
  };
}

/**
 * Toggles the dead marking of the whole live group containing `target`.
 * Marking is score bookkeeping only: the board, the position history and the
 * current player never change. Clicks on empty points, or outside the
 * mark-dead phase, leave the state as is.
 */
export function toggleDeadGroup(state: GameState, target: Point): GameState {
  if (state.phase !== 'mark-dead') {
    return state;
  }

  if (getStone(state.board, target.row, target.column) === null) {
    return state;
  }

  const groupIndices = collectGroup(state.board, target.row, target.column).map(
    (point) => pointToIndex(point.row, point.column),
  );

  const deadPoints = new Set(state.deadPoints);
  const markAsDead = !deadPoints.has(pointToIndex(target.row, target.column));

  for (const index of groupIndices) {
    if (markAsDead) {
      deadPoints.add(index);
    } else {
      deadPoints.delete(index);
    }
  }

  return { ...state, deadPoints };
}

/**
 * Locks in the dead markings and moves the game to the finished phase.
 * Everything else — board, history, dead points, current player — stays
 * exactly as it was; outside mark-dead the call is a no-op.
 */
export function confirmScoring(state: GameState): GameState {
  if (state.phase !== 'mark-dead') {
    return state;
  }

  return { ...state, phase: 'finished' };
}
