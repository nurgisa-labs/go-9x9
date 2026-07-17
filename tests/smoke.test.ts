import { expect, it } from 'vitest';

import { BOARD_SIZE } from '../src/domain/types';

it('uses a nine-line board', () => {
  expect(BOARD_SIZE).toBe(9);
});
