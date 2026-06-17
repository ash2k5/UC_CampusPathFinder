// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render } from '@testing-library/react';
import CategoryIcon from '../../src/components/CategoryIcon';

describe('CategoryIcon', () => {
  it('renders the icon mapped to a known category', () => {
    const { container } = render(<CategoryIcon category="Academic" />);
    expect(container.querySelector('.lucide-graduation-cap')).toBeInTheDocument();
  });

  it('falls back to a map pin for an unknown category', () => {
    const { container } = render(<CategoryIcon category="Nonexistent" />);
    expect(container.querySelector('.lucide-map-pin')).toBeInTheDocument();
  });
});
