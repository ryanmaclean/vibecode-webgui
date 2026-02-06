import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/ai/chat',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  MessageSquare: (props: any) => <svg data-testid="message-square-icon" {...props} />,
}));

// Mock ChatInterface component
jest.mock('@/components/ai/ChatInterface', () => ({
  ChatInterface: () => <div data-testid="chat-interface">ChatInterface Mock</div>,
}));

import AIChatPage from '../page';

describe('AIChatPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<AIChatPage />);
    expect(screen.getByText('AI Chat')).toBeInTheDocument();
  });

  it('shows page heading', () => {
    render(<AIChatPage />);
    const heading = screen.getByText('AI Chat');
    expect(heading.tagName).toBe('H1');
  });

  it('shows page description', () => {
    render(<AIChatPage />);
    expect(screen.getByText('Chat with AI models using streaming responses')).toBeInTheDocument();
  });

  it('renders the MessageSquare icon', () => {
    render(<AIChatPage />);
    expect(screen.getByTestId('message-square-icon')).toBeInTheDocument();
  });

  it('renders the ChatInterface component', () => {
    render(<AIChatPage />);
    expect(screen.getByTestId('chat-interface')).toBeInTheDocument();
  });
});
