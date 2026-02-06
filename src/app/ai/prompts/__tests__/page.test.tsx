import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/prompts',
}));

// Mock the prompt templates module
jest.mock('@/lib/ai/prompts/templates/index', () => {
  const { PromptCategory } = jest.requireActual('@/types/prompts');
  return {
    allBuiltInTemplates: [
      {
        id: 'code-review-standard',
        name: 'Standard Code Review',
        description: 'Comprehensive code review template',
        category: PromptCategory.CODE_REVIEW,
        version: '1.0',
        variables: [
          { name: 'code', description: 'Code to review', type: 'string', required: true },
        ],
        recommendedModels: ['openai/gpt-4o'],
        maxTokens: 4096,
        temperature: 0.3,
        systemPrompt: 'You are a code reviewer.',
        userPromptTemplate: 'Review this: {{code}}',
        tags: ['review', 'quality'],
      },
      {
        id: 'explain-standard',
        name: 'Explain Code',
        description: 'Explain how code works',
        category: PromptCategory.EXPLAIN,
        version: '1.0',
        variables: [
          { name: 'code', description: 'Code to explain', type: 'string', required: true },
        ],
        recommendedModels: ['openai/gpt-4o'],
        maxTokens: 4096,
        temperature: 0.5,
        systemPrompt: 'You explain code.',
        userPromptTemplate: 'Explain this: {{code}}',
        tags: ['explain'],
      },
    ],
  };
});

import PromptsLibraryPage from '../page';

describe('PromptsLibraryPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByText('Prompt Library')).toBeInTheDocument();
  });

  it('shows page heading and template count', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByText('Prompt Library')).toBeInTheDocument();
    expect(screen.getByText(/2 reusable prompt templates/)).toBeInTheDocument();
  });

  it('shows search input', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByPlaceholderText(/Search templates/)).toBeInTheDocument();
  });

  it('shows category tabs', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByText('All Templates')).toBeInTheDocument();
    // "Code Review" and "Explain Code" appear both as tabs and as badges on cards
    const codeReviewTexts = screen.getAllByText('Code Review');
    expect(codeReviewTexts.length).toBeGreaterThanOrEqual(1);
    const explainTexts = screen.getAllByText('Explain Code');
    expect(explainTexts.length).toBeGreaterThanOrEqual(1);
  });

  it('displays template cards', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByText('Standard Code Review')).toBeInTheDocument();
    // "Explain Code" appears as tab + badge, check template name instead
    expect(screen.getByText('Comprehensive code review template')).toBeInTheDocument();
    expect(screen.getByText('Explain how code works')).toBeInTheDocument();
  });

  it('shows template count summary', () => {
    render(<PromptsLibraryPage />);
    expect(screen.getByText(/Showing 2 of 2 templates/)).toBeInTheDocument();
  });

  it('filters templates by search query', () => {
    render(<PromptsLibraryPage />);
    const searchInput = screen.getByPlaceholderText(/Search templates/);
    fireEvent.change(searchInput, { target: { value: 'review' } });
    expect(screen.getByText('Standard Code Review')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 templates/)).toBeInTheDocument();
  });

  it('filters templates by category tab', () => {
    render(<PromptsLibraryPage />);
    // The tab buttons contain both the label text and a count badge.
    // Find the tab button containing "Code Review" text.
    const codeReviewElements = screen.getAllByText('Code Review');
    // Click the first one which is the tab button
    fireEvent.click(codeReviewElements[0]);
    expect(screen.getByText('Standard Code Review')).toBeInTheDocument();
    expect(screen.getByText(/Showing 1 of 2 templates/)).toBeInTheDocument();
  });

  it('shows no results state when search has no matches', () => {
    render(<PromptsLibraryPage />);
    const searchInput = screen.getByPlaceholderText(/Search templates/);
    fireEvent.change(searchInput, { target: { value: 'nonexistenttemplate' } });
    expect(screen.getByText('No templates found')).toBeInTheDocument();
    expect(screen.getByText('Clear Filters')).toBeInTheDocument();
  });

  it('clears filters when Clear Filters button is clicked', () => {
    render(<PromptsLibraryPage />);
    const searchInput = screen.getByPlaceholderText(/Search templates/);
    fireEvent.change(searchInput, { target: { value: 'nonexistenttemplate' } });
    expect(screen.getByText('No templates found')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Clear Filters'));
    expect(screen.getByText('Standard Code Review')).toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2 templates/)).toBeInTheDocument();
  });
});
