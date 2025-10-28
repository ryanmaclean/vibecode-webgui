/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Import after mocks
const OnboardingPage = require('@/app/onboarding/page').default

describe('Onboarding Flow', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(useRouter as jest.Mock).mockReturnValue({
      push: mockPush,
    })
    global.fetch = jest.fn()
  })

  it('renders welcome screen initially', () => {
    render(<OnboardingPage />)
    expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
  })

  it('shows progress bar', () => {
    render(<OnboardingPage />)
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('Extensions')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
  })

  it('navigates to theme selection on get started', () => {
    render(<OnboardingPage />)
    const getStartedButton = screen.getByText(/Get Started/i)
    fireEvent.click(getStartedButton)
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()
  })

  it('allows theme selection', () => {
    render(<OnboardingPage />)
    
    // Navigate to theme step
    fireEvent.click(screen.getByText(/Get Started/i))
    
    // Select dark theme
    const darkButton = screen.getByText('Dark').closest('button')
    expect(darkButton).toBeInTheDocument()
    if (darkButton) {
      fireEvent.click(darkButton)
      expect(darkButton).toHaveClass('border-indigo-600')
    }
  })

  it('allows CLI editor selection', () => {
    render(<OnboardingPage />)
    
    // Navigate to editor step
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    expect(screen.getByText(/CLI Editor Preference/i)).toBeInTheDocument()
    expect(screen.getByText('Vim')).toBeInTheDocument()
    expect(screen.getByText('Neovim')).toBeInTheDocument()
    expect(screen.getByText('Emacs')).toBeInTheDocument()
  })

  it('shows extension recommendations', () => {
    render(<OnboardingPage />)
    
    // Navigate to extensions step
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    expect(screen.getByText(/Recommended Extensions/i)).toBeInTheDocument()
    expect(screen.getByText('Prettier')).toBeInTheDocument()
    expect(screen.getByText('ESLint')).toBeInTheDocument()
  })

  it('shows integration options', () => {
    render(<OnboardingPage />)
    
    // Navigate to integrations step
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    expect(screen.getByText(/Connect Your Tools/i)).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('OpenAI')).toBeInTheDocument()
    expect(screen.getByText('Anthropic')).toBeInTheDocument()
  })

  it('allows navigation back', () => {
    render(<OnboardingPage />)
    
    // Navigate forward
    fireEvent.click(screen.getByText(/Get Started/i))
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()
    
    // Navigate back
    fireEvent.click(screen.getByText(/Back/i))
    expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
  })

  it('completes onboarding and saves preferences', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<OnboardingPage />)
    
    // Navigate through all steps
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    // Complete onboarding
    expect(screen.getByText(/You're All Set!/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Start Coding/i))
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/user/preferences',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      )
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('allows extension selection', () => {
    render(<OnboardingPage />)
    
    // Navigate to extensions
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    // Find and click prettier checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    
    // Toggle first checkbox
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
  })

  it('allows integration selection', () => {
    render(<OnboardingPage />)
    
    // Navigate to integrations
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    
    // Find GitHub checkbox
    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes.length).toBeGreaterThan(0)
    
    // Toggle GitHub
    fireEvent.click(checkboxes[0])
    expect(checkboxes[0]).toBeChecked()
  })
})
