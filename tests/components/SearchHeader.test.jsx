// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SearchHeader from '../../src/components/SearchHeader';

const baseProps = {
  searchQuery: '',
  searchResults: [],
  onSearchInput: () => {},
  onSelectResult: () => {},
  isAdmin: false,
  onSignOut: () => {},
};

describe('SearchHeader', () => {
  it('exposes the search box by an accessible name', () => {
    render(<SearchHeader {...baseProps} />);
    expect(screen.getByRole('textbox', { name: /search campus buildings/i })).toBeInTheDocument();
  });

  it('lists results and reports the selected one', () => {
    const onSelectResult = vi.fn();
    const results = [{ name: 'Langsam Library', category: 'Library' }];
    render(<SearchHeader {...baseProps} searchResults={results} onSelectResult={onSelectResult} />);
    fireEvent.click(screen.getByRole('button', { name: /langsam library/i }));
    expect(onSelectResult).toHaveBeenCalledWith(results[0]);
  });

  it('shows the admin badge only for admins', () => {
    const { rerender } = render(<SearchHeader {...baseProps} isAdmin={false} />);
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
    rerender(<SearchHeader {...baseProps} isAdmin />);
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
