// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import Toast from '../../src/components/Toast';

describe('Toast', () => {
  it('renders nothing when there is no toast', () => {
    const { container } = render(<Toast toast={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('announces the message in a polite live region', () => {
    render(<Toast toast={{ msg: 'Path saved', type: 'success' }} />);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Path saved');
    expect(status).toHaveAttribute('aria-live', 'polite');
  });
});
