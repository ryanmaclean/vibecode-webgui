import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>{children}</a>
  );
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Brain: (props: any) => <svg data-testid="icon-brain" {...props} />,
  MessageSquare: (props: any) => <svg data-testid="icon-message" {...props} />,
  Bot: (props: any) => <svg data-testid="icon-bot" {...props} />,
  Cpu: (props: any) => <svg data-testid="icon-cpu" {...props} />,
  DollarSign: (props: any) => <svg data-testid="icon-dollar" {...props} />,
  BookOpen: (props: any) => <svg data-testid="icon-book" {...props} />,
  History: (props: any) => <svg data-testid="icon-history" {...props} />,
  Plus: (props: any) => <svg data-testid="icon-plus" {...props} />,
  ArrowRight: (props: any) => <svg data-testid="icon-arrow" {...props} />,
  Activity: (props: any) => <svg data-testid="icon-activity" {...props} />,
  Clock: (props: any) => <svg data-testid="icon-clock" {...props} />,
  Zap: (props: any) => <svg data-testid="icon-zap" {...props} />,
  TrendingUp: (props: any) => <svg data-testid="icon-trending" {...props} />,
}));

import AIPage from '../page';

describe('AIPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AIPage />);
    expect(screen.getByText('AI Dashboard')).toBeInTheDocument();
  });

  it('renders AI Dashboard title as heading', () => {
    render(<AIPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('AI Dashboard');
  });

  it('renders the page description', () => {
    render(<AIPage />);
    expect(
      screen.getByText(/Access 321\+ AI models, manage agents, track costs/)
    ).toBeInTheDocument();
  });

  it('renders Chat overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('Chat')).toBeInTheDocument();
    expect(screen.getByText('Start or continue AI conversations')).toBeInTheDocument();
  });

  it('renders Agents overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
    expect(screen.getByText('Multi-agent workspace')).toBeInTheDocument();
  });

  it('renders Models overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('Models')).toBeInTheDocument();
    expect(screen.getByText('Compare and select AI models')).toBeInTheDocument();
  });

  it('renders Costs overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('Costs')).toBeInTheDocument();
    expect(screen.getByText('Track AI usage costs')).toBeInTheDocument();
  });

  it('renders Prompts overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('Prompts')).toBeInTheDocument();
    expect(screen.getByText('Browse prompt library')).toBeInTheDocument();
  });

  it('renders History overview card', () => {
    render(<AIPage />);
    expect(screen.getByText('History')).toBeInTheDocument();
    expect(screen.getByText('View past conversations')).toBeInTheDocument();
  });

  it('has correct href for each overview card', () => {
    render(<AIPage />);
    const links = screen.getAllByRole('link');
    const hrefs = links.map((link) => link.getAttribute('href'));
    expect(hrefs).toContain('/ai/chat');
    expect(hrefs).toContain('/ai/agents');
    expect(hrefs).toContain('/ai/models');
    expect(hrefs).toContain('/ai/costs');
    expect(hrefs).toContain('/ai/prompts');
    expect(hrefs).toContain('/ai/conversations');
  });

  it('renders New Chat quick action button', () => {
    render(<AIPage />);
    expect(screen.getByText('New Chat')).toBeInTheDocument();
  });

  it('renders Compare Models quick action button', () => {
    render(<AIPage />);
    expect(screen.getByText('Compare Models')).toBeInTheDocument();
  });

  it('renders Browse Prompts quick action button', () => {
    render(<AIPage />);
    expect(screen.getByText('Browse Prompts')).toBeInTheDocument();
  });

  it('renders usage stats section', () => {
    render(<AIPage />);
    expect(screen.getByText('Requests Today')).toBeInTheDocument();
    expect(screen.getByText('47')).toBeInTheDocument();
    expect(screen.getByText('Avg Response Time')).toBeInTheDocument();
    expect(screen.getByText('1.2s')).toBeInTheDocument();
    expect(screen.getByText('Top Model')).toBeInTheDocument();
    expect(screen.getByText('Claude 3.5 Sonnet')).toBeInTheDocument();
  });

  it('renders recent activity section', () => {
    render(<AIPage />);
    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByText('Used Claude 3.5 Sonnet for code review')).toBeInTheDocument();
    expect(screen.getByText('Generated unit tests with GPT-4o')).toBeInTheDocument();
    expect(screen.getByText('Refactored auth module via multi-agent')).toBeInTheDocument();
  });

  it('renders all 6 overview cards', () => {
    render(<AIPage />);
    const cardTitles = ['Chat', 'Agents', 'Models', 'Costs', 'Prompts', 'History'];
    cardTitles.forEach((title) => {
      expect(screen.getByText(title)).toBeInTheDocument();
    });
  });
});
