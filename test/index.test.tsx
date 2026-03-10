import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import React from 'react';

import {Link, View, useData, useLoading, useMatched} from '../src/index';

// Mock the core module
vi.mock('@native-router/core', () => ({
  toLocation: vi.fn(() => ({pathname: '/test'})),
  createHref: vi.fn(() => '/test'),
  resolve: vi.fn(async () => ({default: null})),
  commit: vi.fn(),
  navigate: vi.fn()
}));

describe('Router', () => {
  describe('exports', () => {
    it('should export Link', async () => {
      const {Link: LinkComponent} = await import('../src/index');
      expect(LinkComponent).toBeDefined();
    });

    it('should export View', () => {
      expect(View).toBeDefined();
    });

    it('should export useData', () => {
      expect(useData).toBeDefined();
    });

    it('should export useLoading', () => {
      expect(useLoading).toBeDefined();
    });

    it('should export useMatched', () => {
      expect(useMatched).toBeDefined();
    });
  });

  describe('View', () => {
    it('should be a component', () => {
      expect(typeof View).toBe('function');
    });
  });

  describe('Link', () => {
    it('should Render with children', () => {
      render(
        <Link to="/test">
          <span>Child</span>
        </Link>
      );
      expect(screen.getByText('Child')).toBeDefined();
    });
  });
});
