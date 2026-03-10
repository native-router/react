import {cleanup} from '@testing-library/react';
import {afterEach, vi} from 'vitest';

afterEach(() => {
  cleanup();
});

global.localStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn()
};
