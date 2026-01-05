/**
 * @jest-environment jsdom
 */

import { screen, fireEvent, waitFor, renderWithProviders } from '../test-utils'
import { useRouter } from 'next/navigation'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))

// Mock next-themes
jest.mock('next-themes', () => ({
  useTheme: jest.fn(() => ({
    theme: 'light',
    setTheme: jest.fn(),
  })),
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
    // Mock the preferences API call
    global.fetch = jest.fn((url, options) => {
      if (url === '/api/user/preferences' || url.includes('/api/user/preferences')) {
        const method = options?.method || 'GET'

        if (method === 'GET') {
          // Return 401 for GET so defaults are used
          return Promise.resolve({
            ok: false,
            status: 401,
            json: async () => ({}),
          } as Response)
        } else if (method === 'POST') {
          // Return success for POST (saving preferences)
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({
              preferences: {
                theme: 'dark',
                cliEditor: 'vim',
                preferredIde: 'vs-code',
                extensions: [],
                integrations: {},
                aiProviders: [],
                onboardingCompleted: true,
              },
            }),
          } as Response)
        }
      }
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true }),
      } as Response)
    })
  })

  it('renders welcome screen initially', async () => {
    renderWithProviders(<OnboardingPage />)
    await waitFor(() => {
      expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
    })
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
  })

  it('shows progress bar', async () => {
    renderWithProviders(<OnboardingPage />)
    // Progress bar is shown immediately, but wait for content to load
    await waitFor(() => {
      expect(screen.getByText('Welcome')).toBeInTheDocument()
    })
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Workspace')).toBeInTheDocument()
    expect(screen.getByText('Editor')).toBeInTheDocument()
    expect(screen.getByText('Extensions')).toBeInTheDocument()
    expect(screen.getByText('Integrations')).toBeInTheDocument()
    expect(screen.getByText('AI')).toBeInTheDocument()
  })

  it('navigates to theme selection on get started', async () => {
    renderWithProviders(<OnboardingPage />)
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    const getStartedButton = screen.getByText(/Get Started/i)
    fireEvent.click(getStartedButton)
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()
  })

  it('allows theme selection', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to theme step
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))

    // Select dark theme
    const darkButton = screen.getByText('Dark').closest('button')
    expect(darkButton).toBeInTheDocument()
    if (darkButton) {
      fireEvent.click(darkButton)
      expect(darkButton).toHaveClass('border-indigo-600')
    }
  })

  it('allows CLI editor selection', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to editor step
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/CLI Editor Preference/i)).toBeInTheDocument()
    expect(screen.getByText('Vim')).toBeInTheDocument()
    expect(screen.getByText('Neovim')).toBeInTheDocument()
    expect(screen.getByText('Nano')).toBeInTheDocument()
  })

  it('shows extension recommendations', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to extensions step
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/Recommended Extensions/i)).toBeInTheDocument()
    expect(screen.getByText('Prettier')).toBeInTheDocument()
    expect(screen.getByText('ESLint')).toBeInTheDocument()
  })

  it('shows integration options', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to integrations step
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))
    fireEvent.click(screen.getByText(/Continue/i))

    expect(screen.getByText(/Connect Your Tools/i)).toBeInTheDocument()
    expect(screen.getByText('GitHub')).toBeInTheDocument()
    expect(screen.getByText('Datadog')).toBeInTheDocument()
  })

  it('allows navigation back', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate forward
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))
    expect(screen.getByText(/Choose Your Theme/i)).toBeInTheDocument()

    // Navigate back
    fireEvent.click(screen.getByText(/Back/i))
    expect(screen.getByText(/Welcome to VibeCode/i)).toBeInTheDocument()
  })

  it('completes onboarding and saves preferences', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })

    // Navigate through all steps: welcome → theme → workspace → editor → extensions → integrations → ai → complete
    fireEvent.click(screen.getByText(/Get Started/i)) // theme
    fireEvent.click(screen.getByText(/Continue/i)) // workspace
    fireEvent.click(screen.getByText(/Continue/i)) // editor
    fireEvent.click(screen.getByText(/Continue/i)) // extensions
    fireEvent.click(screen.getByText(/Continue/i)) // integrations
    fireEvent.click(screen.getByText(/Continue/i)) // ai
    fireEvent.click(screen.getByText(/Continue/i)) // complete

    // Complete onboarding
    expect(screen.getByText(/You're all set/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText(/Launch Workspace/i))

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

  it('allows extension selection', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to extensions
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
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

  it('allows integration selection', async () => {
    renderWithProviders(<OnboardingPage />)

    // Wait for loading and navigate to integrations
    await waitFor(() => {
      expect(screen.getByText(/Get Started/i)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText(/Get Started/i))
    fireEvent.click(screen.getByText(/Continue/i))
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
