import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from '@jest/globals';
import { AIChatInterface } from '../../src/components/ai/AIChatInterface';



describe('Minimal AIChatInterface Test', () => {
  it('should render without crashing', () => {

    render(<AIChatInterface />);
    // A simple assertion to ensure the component renders something.
    // We can check for a more specific element later.
    expect(screen.getByText('VibeCode AI')).toBeInTheDocument();
  });
});
