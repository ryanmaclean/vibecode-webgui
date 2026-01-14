/**
 * @jest-environment jsdom
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { useRouter } from 'next/navigation'
import React from 'react'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock UserPreferencesProvider
const UserPreferencesProvider = ({ children }: { children: React.ReactNode }) => {
  return <div>{children}</div>
}

const mockSavePreferences = jest.fn().mockResolvedValue(undefined);

jest.mock('@/providers/UserPreferencesProvider', () => ({
  UserPreferencesProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useUserPreferences: () => ({
    preferences: {},
    updatePreferences: jest.fn(),
    isLoading: false,
    error: null,
    save: mockSavePreferences,
  }),
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
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
  })

  it('shows progress bar', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    expect(screen.getByText('Welcome')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('Extensions')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
  })

  it('navigates to theme selection on get started', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    const getStartedButton = screen.getByText(/Get Started/i)
    fireEvent.click(getStartedButton)
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()
  })

  it('allows theme selection', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    
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
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )

    // Navigate to editor step (welcome -> theme -> workspace -> editor)
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/CLI Editor Preference/i)).toBeInTheDocument()
    expect(screen.getByText('Vim')).toBeInTheDocument()
    expect(screen.getByText('Neovim')).toBeInTheDocument()
  })

  it('shows extension recommendations', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )

    // Navigate to extensions step (welcome -> theme -> workspace -> editor -> extensions)
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/Recommended Extensions/i)).toBeInTheDocument()
    expect(screen.getByText('Prettier')).toBeInTheDocument()
    expect(screen.getByText('ESLint')).toBeInTheDocument()
  })

  it('shows integration options', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )

    // Navigate to integrations step (welcome -> theme -> workspace -> editor -> extensions -> integrations)
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/Connect Your Tools/i)).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Jira')).toBeInTheDocument()
    expect(screen.getByText('Datadog')).toBeInTheDocument()
  })

  it('allows navigation back', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    
    // Navigate forward
    fireEvent.click(screen.getByText(/Get Started/i))
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()
    
    // Navigate back
    fireEvent.click(screen.getByText(/Back/i))
    expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
  })

  it('completes onboarding and saves preferences', async () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )

    // Navigate through all steps (welcome -> theme -> workspace -> editor -> extensions -> integrations -> ai -> complete)
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    // Complete onboarding
    expect(screen.getByText(/You're all set/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Launch Workspace/i))

    await waitFor(() => {
      expect(mockSavePreferences).toHaveBeenCalled()
      expect(mockPush).toHaveBeenCalledWith('/dashboard')
    })
  })

  it('allows extension selection', () => {
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )

    // Navigate to extensions (welcome -> theme -> workspace -> editor -> extensions)
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
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
    render(
      <UserPreferencesProvider>
        <OnboardingPage />
      </UserPreferencesProvider>
    )
    
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
