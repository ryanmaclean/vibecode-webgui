import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/agents',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  Bot: (props: any) => <svg data-testid="bot-icon" {...props} />,
  Code: (props: any) => <svg data-testid="code-icon" {...props} />,
  Bug: (props: any) => <svg data-testid="bug-icon" {...props} />,
  Building2: (props: any) => <svg data-testid="building-icon" {...props} />,
  Eye: (props: any) => <svg data-testid="eye-icon" {...props} />,
  FlaskConical: (props: any) => <svg data-testid="flask-icon" {...props} />,
  Server: (props: any) => <svg data-testid="server-icon" {...props} />,
  Send: (props: any) => <svg data-testid="send-icon" {...props} />,
  X: (props: any) => <svg data-testid="x-icon" {...props} />,
  ChevronDown: (props: any) => <svg data-testid="chevron-down-icon" {...props} />,
  User: (props: any) => <svg data-testid="user-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
}));

import AIAgentsPage from '../page';

describe('AIAgentsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders without crashing', () => {
    render(<AIAgentsPage />);
    expect(screen.getByText('AI Agents')).toBeInTheDocument();
  });

  it('renders page title as heading', () => {
    render(<AIAgentsPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('AI Agents');
  });

  it('renders agent workspace description', () => {
    render(<AIAgentsPage />);
    expect(
      screen.getByText(/Manage concurrent conversations with specialized AI agents/)
    ).toBeInTheDocument();
  });

  it('renders Code Assistant agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Code Assistant').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Debug Helper agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Debug Helper').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Architect agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Architect').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Reviewer agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Reviewer').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Tester agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Tester').length).toBeGreaterThanOrEqual(1);
  });

  it('renders DevOps agent', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('DevOps').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Available Agents heading in sidebar', () => {
    render(<AIAgentsPage />);
    expect(screen.getByText('Available Agents')).toBeInTheDocument();
  });

  it('shows agent role descriptions', () => {
    render(<AIAgentsPage />);
    expect(screen.getAllByText('Full-Stack Developer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Bug Hunter').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('System Designer').length).toBeGreaterThanOrEqual(1);
  });

  it('selects a different agent when clicked', () => {
    render(<AIAgentsPage />);

    // Initially Code Assistant is selected and its initial message is shown
    expect(
      screen.getByText(/I can help you write, refactor, or explain code/)
    ).toBeInTheDocument();

    // Click Debug Helper in the sidebar (the hidden md:block sidebar has buttons)
    const buttons = screen.getAllByRole('button');
    const debugButton = buttons.find((btn) =>
      btn.textContent?.includes('Debug Helper') && btn.textContent?.includes('Bug Hunter')
    );
    expect(debugButton).toBeDefined();
    fireEvent.click(debugButton!);

    // Debug Helper's initial message should appear
    expect(
      screen.getByText(/Ready to squash some bugs/)
    ).toBeInTheDocument();
  });

  it('renders message input textarea', () => {
    render(<AIAgentsPage />);
    expect(screen.getByPlaceholderText('Message Code Assistant...')).toBeInTheDocument();
  });

  it('renders Send button', () => {
    render(<AIAgentsPage />);
    expect(screen.getByText('Send')).toBeInTheDocument();
  });

  it('has Send button disabled when input is empty', () => {
    render(<AIAgentsPage />);
    const sendButton = screen.getByText('Send').closest('button');
    expect(sendButton).toBeDisabled();
  });
});
