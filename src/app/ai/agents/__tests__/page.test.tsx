import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/agents',
}));

const MOCK_AGENTS = [
  {
    id: '1',
    name: 'Code Assistant',
    model: 'claude-sonnet-4-6',
    instructions: 'I can help you write, refactor, or explain code.',
    description: 'I can help you write, refactor, or explain code.',
    metadata: { role: 'Full-Stack Developer' },
    status: 'active',
  },
  {
    id: '2',
    name: 'Debug Helper',
    model: 'claude-sonnet-4-6',
    instructions: 'Ready to squash some bugs.',
    description: 'Ready to squash some bugs.',
    metadata: { role: 'Bug Hunter' },
    status: 'active',
  },
  {
    id: '3',
    name: 'Architect',
    model: 'claude-sonnet-4-6',
    instructions: 'Design scalable systems.',
    description: 'Design scalable systems.',
    metadata: { role: 'System Designer' },
    status: 'active',
  },
  {
    id: '4',
    name: 'Reviewer',
    model: 'claude-sonnet-4-6',
    instructions: 'Review code for quality.',
    description: 'Review code for quality.',
    metadata: { role: 'Code Reviewer' },
    status: 'active',
  },
  {
    id: '5',
    name: 'Tester',
    model: 'claude-sonnet-4-6',
    instructions: 'Write and run tests.',
    description: 'Write and run tests.',
    metadata: { role: 'QA Engineer' },
    status: 'active',
  },
  {
    id: '6',
    name: 'DevOps',
    model: 'claude-sonnet-4-6',
    instructions: 'Manage infrastructure.',
    description: 'Manage infrastructure.',
    metadata: { role: 'DevOps Engineer' },
    status: 'active',
  },
];

function createFetchMock() {
  return jest.fn((_url: string) =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ data: MOCK_AGENTS, total: MOCK_AGENTS.length }),
    })
  ) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<AIAgentsPage />);
  await waitFor(() => {
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });
}

import AIAgentsPage from '../page';

describe('AIAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('renders page title as heading', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('AI Agents');
  });

  it('renders agent workspace description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText(/Manage concurrent conversations with specialized AI agents/)
    ).toBeInTheDocument();
  });

  it('renders Code Assistant agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Code Assistant').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Debug Helper agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Debug Helper').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Architect agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Architect').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Reviewer agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Reviewer').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Tester agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Tester').length).toBeGreaterThanOrEqual(1);
  });

  it('renders DevOps agent', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('DevOps').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Available Agents heading in sidebar', async () => {
    await renderAndSettle();
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('shows agent role descriptions', async () => {
    await renderAndSettle();
    expect(screen.getAllByText('Full-Stack Developer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bug Hunter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('System Designer').length).toBeGreaterThanOrEqual(1);
  });

  it('selects a different agent when clicked', async () => {
    await renderAndSettle();

    // Initially Code Assistant description is shown in the conversation panel
    expect(
      screen.getByText(/I can help you write, refactor, or explain code/)
    ).toBeInTheDocument();

    // Click Debug Helper in the sidebar
    const buttons = screen.getAllByRole('button');
    const debugButton = buttons.find((btn) =>
      btn.textContent?.includes('Debug Helper') && btn.textContent?.includes('Bug Hunter')
    );
    expect(debugButton).toBeDefined();
    fireEvent.click(debugButton!);

    // Debug Helper's description should appear
    await waitFor(() => {
      expect(screen.getByText(/Ready to squash some bugs/)).toBeInTheDocument();
    });
  });

  it('renders message input textarea', async () => {
    await renderAndSettle();
    expect(screen.getByPlaceholderText('Message Code Assistant...')).toBeInTheDocument();
  });

  it('renders Send button', async () => {
    await renderAndSettle();
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('has Send button disabled when input is empty', async () => {
    await renderAndSettle();
    const sendButton = screen.getByText('Send').closest('button');
    expect(sendButton).toBeDisabled();
  });
});
