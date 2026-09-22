/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { TickerSearchInput } from './TickerSearchInput';
import { useTickerSearch } from '../hooks/useTickerSearch';

const mockResults = [
  { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', type: 'EQUITY' },
  { symbol: 'MSFT', name: 'Microsoft Corp.', exchange: 'NASDAQ', type: 'EQUITY' },
];

vi.mock('../hooks/useTickerSearch');

afterEach(() => {
  cleanup();
});

beforeEach(() => {
  vi.mocked(useTickerSearch).mockReturnValue({
    results: mockResults,
    loading: false,
    search: vi.fn(),
    clear: vi.fn(),
  });
});

const getInput = () => screen.getByPlaceholderText('Search ticker...');

function openDropdown() {
  fireEvent.focus(getInput());
  fireEvent.change(getInput(), { target: { value: '' } });
}

describe('TickerSearchInput', () => {
  it('renders the input with the given value', () => {
    render(<TickerSearchInput value="AAPL" onChange={vi.fn()} />);
    expect(getInput()).toHaveValue('AAPL');
  });

  it('shows the listbox on focus when results exist', () => {
    render(<TickerSearchInput value="" onChange={vi.fn()} />);
    openDropdown();
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('shows options in the dropdown', () => {
    render(<TickerSearchInput value="" onChange={vi.fn()} />);
    openDropdown();
    expect(screen.getByText('AAPL')).toBeInTheDocument();
    expect(screen.getByText('MSFT')).toBeInTheDocument();
    expect(screen.getByText((c) => c.includes('Apple Inc.'))).toBeInTheDocument();
  });

  it('does not show a hint when value matches query', () => {
    render(<TickerSearchInput value="AAPL" onChange={vi.fn()} />);
    expect(
      screen.queryByText('Select a ticker from the dropdown to confirm'),
    ).not.toBeInTheDocument();
  });

  it('shows searching text when loading', () => {
    vi.mocked(useTickerSearch).mockReturnValue({
      results: [],
      loading: true,
      search: vi.fn(),
      clear: vi.fn(),
    });
    render(<TickerSearchInput value="" onChange={vi.fn()} />);
    // Type at least one character to trigger onChange which sets showDropdown
    fireEvent.change(getInput(), { target: { value: 'A' } });
    expect(screen.getByText('Searching...')).toBeInTheDocument();
  });

  describe('select, then retype scenario (the bug)', () => {
    it('calls onChange("AAPL") when a dropdown item is clicked', () => {
      const onChange = vi.fn();
      render(<TickerSearchInput value="" onChange={onChange} />);
      openDropdown();
      fireEvent.mouseDown(screen.getByText('AAPL'));

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith('AAPL');
    });

    it('clears the parent ticker when the typed text diverges from a confirmed selection', () => {
      const onChange = vi.fn();
      const { rerender } = render(
        <TickerSearchInput value="AAPL" onChange={onChange} />,
      );

      // Confirm AAPL
      openDropdown();
      fireEvent.mouseDown(screen.getByText('AAPL'));
      onChange.mockClear();

      // Rerender with confirmed AAPL
      rerender(<TickerSearchInput value="AAPL" onChange={onChange} />);

      // Type MSFT — should clear parent ticker
      fireEvent.change(getInput(), { target: { value: 'MSFT' } });

      expect(onChange).toHaveBeenCalledWith('');
      // The hint should appear
      expect(
        screen.getByText('Select a ticker from the dropdown to confirm'),
      ).toBeInTheDocument();
    });

    it('selects a different ticker from the dropdown', () => {
      const onChange = vi.fn();
      render(<TickerSearchInput value="" onChange={onChange} />);
      openDropdown();
      fireEvent.mouseDown(screen.getByText('MSFT'));
      expect(onChange).toHaveBeenCalledWith('MSFT');
    });

    it('closes the dropdown after clicking a selection', () => {
      const onChange = vi.fn();
      render(<TickerSearchInput value="" onChange={onChange} />);
      openDropdown();
      fireEvent.mouseDown(screen.getByText('AAPL'));
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('highlights the first option on ArrowDown', () => {
      render(<TickerSearchInput value="" onChange={vi.fn()} />);
      openDropdown();

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' });

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('selects the highlighted option on Enter', () => {
      const onChange = vi.fn();
      render(<TickerSearchInput value="" onChange={onChange} />);
      openDropdown();

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' }); // highlight AAPL
      fireEvent.keyDown(getInput(), { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith('AAPL');
    });

    it('cycles highlight with ArrowDown past the end', () => {
      render(<TickerSearchInput value="" onChange={vi.fn()} />);
      openDropdown();

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' }); // 0
      fireEvent.keyDown(getInput(), { key: 'ArrowDown' }); // 1
      fireEvent.keyDown(getInput(), { key: 'ArrowDown' }); // wraps to 0

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('wraps highlight with ArrowUp past the beginning', () => {
      render(<TickerSearchInput value="" onChange={vi.fn()} />);
      openDropdown();

      fireEvent.keyDown(getInput(), { key: 'ArrowUp' }); // wraps to last (MSFT)

      const options = screen.getAllByRole('option');
      expect(options[options.length - 1]).toHaveAttribute(
        'aria-selected',
        'true',
      );
    });

    it('closes dropdown on Escape and resets highlight', () => {
      const onChange = vi.fn();
      render(<TickerSearchInput value="" onChange={onChange} />);
      openDropdown();

      fireEvent.keyDown(getInput(), { key: 'ArrowDown' }); // highlight
      fireEvent.keyDown(getInput(), { key: 'Escape' });

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      // Enter should NOT select anything now
      fireEvent.keyDown(getInput(), { key: 'Enter' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });
});
