export const BOARD_SIZE = 9;

export type Player = 'black' | 'white';

export type Stone = Player | null;

export type Board = readonly Stone[];

export type Point = {
  readonly row: number;
  readonly column: number;
};
