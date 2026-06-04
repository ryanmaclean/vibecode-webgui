import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/conversations',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

import AIConversationsPage from '../page';

describe('AIConversationsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AIConversationsPage />);
    expect(screen.getByText('Conversation History')).toBeInTheDocument();
  });

  it('renders page title as heading', () => {
    render(<AIConversationsPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Conversation History');
  });

  it('renders page description', () => {
    render(<AIConversationsPage />);
    expect(
      screen.getByText('Browse, search, and manage your past AI conversations')
    ).toBeInTheDocument();
  });

  it('renders stats row with Total Conversations', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('Total Conversations')).toBeInTheDocument());
    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('renders Active stat', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('Total Conversations')).toBeInTheDocument());
    // "Active" appears as a stat label and tab - check both exist
    const activeTexts = screen.getAllByText(/Active/);
    expect(activeTexts.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('10')).toBeInTheDocument();
  });

  it('renders Archived stat', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('Total Conversations')).toBeInTheDocument());
    expect(screen.getByText('Archived')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('renders Total Cost stat', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('Total Cost')).toBeInTheDocument());
  });

  it('renders search input', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(
      screen.getByPlaceholderText('Search conversations by title or model...')
    ).toBeInTheDocument());
  });

  it('renders conversation titles', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(
      screen.getByText(/Help me refactor this React component/)
    ).toBeInTheDocument());
    expect(
      screen.getByText(/Write a Python script to parse CSV files/)
    ).toBeInTheDocument();
  });

  it('renders model badges', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getAllByText('Claude 3.5 Sonnet').length).toBeGreaterThanOrEqual(1));
    expect(screen.getAllByText('GPT-4o').length).toBeGreaterThanOrEqual(1);
  });

  it('renders sort dropdown with options', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThanOrEqual(1));
    const sortSelect = screen.getAllByRole('combobox');
    expect(sortSelect.length).toBeGreaterThanOrEqual(1);

    // Check sort options exist
    const options = screen.getAllByRole('option');
    const optionTexts = options.map((o) => o.textContent);
    expect(optionTexts).toContain('Most Recent');
    expect(optionTexts).toContain('Oldest First');
    expect(optionTexts).toContain('Most Messages');
    expect(optionTexts).toContain('Highest Cost');
  });

  it('renders Filters button and toggles filter section', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('Filters')).toBeInTheDocument());
    const filtersBtn = screen.getByText('Filters');
    expect(filtersBtn).toBeInTheDocument();

    fireEvent.click(filtersBtn);

    expect(screen.getByText('Model Provider')).toBeInTheDocument();
    expect(screen.getByText('Date Range')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('shows archive and delete action buttons on conversations', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getAllByTitle('Archive').length).toBeGreaterThanOrEqual(1));
    const archiveButtons = screen.getAllByTitle('Archive');
    expect(archiveButtons.length).toBeGreaterThanOrEqual(1);
    const deleteButtons = screen.getAllByTitle('Delete conversation');
    expect(deleteButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Load More button when there are more than 8 conversations', async () => {
    render(<AIConversationsPage />);
    // 10 active conversations, page size 8, so Load More should be present
    await waitFor(() => expect(screen.getByText(/Load More/)).toBeInTheDocument());
  });

  it('shows empty state when search has no results', async () => {
    render(<AIConversationsPage />);
    const searchInput = await waitFor(() => screen.getByPlaceholderText('Search conversations by title or model...'));
    fireEvent.change(searchInput, { target: { value: 'zzzzzzzzzznotfound' } });

    expect(screen.getByText('No conversations found')).toBeInTheDocument();
    expect(
      screen.getByText('Try adjusting your search or filter criteria.')
    ).toBeInTheDocument();
  });

  it('filters conversations by search query', async () => {
    render(<AIConversationsPage />);
    const searchInput = await waitFor(() => screen.getByPlaceholderText('Search conversations by title or model...'));
    fireEvent.change(searchInput, { target: { value: 'Terraform' } });

    expect(
      screen.getByText(/Review my Terraform configuration/)
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Help me refactor this React component/)
    ).not.toBeInTheDocument();
  });

  it('deletes a conversation when delete button is clicked', async () => {
    render(<AIConversationsPage />);
    await waitFor(() => expect(screen.getByText('12')).toBeInTheDocument()); // Total starts at 12

    const deleteButtons = screen.getAllByTitle('Delete conversation');
    fireEvent.click(deleteButtons[0]);

    expect(screen.getByText('11')).toBeInTheDocument(); // Total now 11
  });
});
