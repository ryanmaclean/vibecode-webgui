/**
 * @jest-environment jsdom
 */

<<<<<<< HEAD
// Mock the entire ProjectGenerator module
const mockProjectGenerator = ({ onComplete, initialPrompt, autoStart }: any) => {
  const mockReact = require('react')
  const [isGenerating, setIsGenerating] = mockReact.useState(false)
  const [prompt, setPrompt] = mockReact.useState(initialPrompt || '')

  const handleGenerate = () => {
    if (!prompt.trim()) return

    setIsGenerating(true)

    // Simulate API call with delay to match real component behavior
    setTimeout(() => {
      setIsGenerating(false)
      onComplete?.({
        workspaceId: 'ai-project-123',
        projectName: 'test-project',
        projectStructure: {
          name: 'test-project',
          description: 'Test project description',
          language: 'JavaScript',
          framework: 'React',
          files: []
        }
      })
    }, 100)
  }

  return (
    <div>
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="A modern React dashboard with dark mode..."
        data-testid="prompt-input"
      />
      <button
        onClick={handleGenerate}
        disabled={isGenerating || !prompt.trim()}
        data-testid="generate-button"
      >
        {isGenerating ? 'Generating...' : 'Generate'}
      </button>
      
      {isGenerating && (
        <div data-testid="loading-state">
          <span>Generating...</span>
          <div role="progressbar" />
        </div>
      )}
    </div>
  )
}

=======
// Mock the ProjectGenerator component before any imports
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
jest.mock('@/components/ProjectGenerator', () => ({
  ProjectGenerator: ({ onComplete, initialPrompt, autoStart }: any) => {
    const React = require('react')
    const [isGenerating, setIsGenerating] = React.useState(false)
    const [prompt, setPrompt] = React.useState(initialPrompt || '')

    const handleGenerate = () => {
      if (!prompt.trim()) return

      setIsGenerating(true)

      // Simulate API call with delay to match real component behavior
      setTimeout(() => {
        setIsGenerating(false)
        onComplete?.({
          workspaceId: 'ai-project-123',
          projectName: 'test-project'
        })
      }, 100)
    }

    return React.createElement('div', null, [
      React.createElement('input', {
        key: 'input',
        type: 'text',
        value: prompt,
        onChange: (e: any) => setPrompt(e.target.value),
        placeholder: 'A modern React dashboard with dark mode...',
        'data-testid': 'prompt-input'
      }),
      React.createElement('button', {
        key: 'button',
        onClick: handleGenerate,
        disabled: isGenerating || !prompt.trim(),
        'data-testid': 'generate-button'
      }, isGenerating ? 'Generating...' : 'Generate'),
      isGenerating && React.createElement('div', {
        key: 'loading',
        'data-testid': 'loading-state'
      }, [
        React.createElement('span', { key: 'text' }, 'Generating...'),
        React.createElement('div', { key: 'progress', role: 'progressbar' })
      ])
    ])
  }
}))

import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SessionProvider } from 'next-auth/react'
import { AIProjectGenerator } from '@/components/projects/AIProjectGenerator'

// Mock Next.js router
const mockPush = jest.fn()
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}))

// Mock fetch
global.fetch = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    ok: true,
    json: jest.fn().mockImplementation(() => {
      return Promise.resolve({
        success: true,
        workspaceUrl: '/workspace/ai-project-123',
        projectStructure: {
          name: 'test-project',
          description: 'Test project description',
          language: 'JavaScript',
          framework: 'React',
          files: [],
          fileCount: 0
        }
      })
    }),
  })
})

const mockSession = {
  user: {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User'
  }
}

describe('AIProjectGenerator Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockPush.mockClear()
  })

  it('renders the component with title and description', () => {
    render(
      <SessionProvider session={null}>
        <AIProjectGenerator />
      </SessionProvider>
    )

    expect(screen.getByText('AI Project Generator')).toBeInTheDocument()
    expect(screen.getByText(/Describe your project and let AI generate the code/)).toBeInTheDocument()
  })

  it('renders the ProjectGenerator component', () => {
    render(
      <SessionProvider session={null}>
        <AIProjectGenerator />
      </SessionProvider>
    )
    
    expect(screen.getByTestId('prompt-input')).toBeInTheDocument()
    expect(screen.getByTestId('generate-button')).toBeInTheDocument()
  })

  it('handles project generation completion', async () => {
    // Mock fetch for the actual API call made by the component
    ;(global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValue({
        success: true,
        workspaceUrl: '/workspace/ai-project-123',
        projectStructure: {
          name: 'test-project',
          description: 'Test project description',
          language: 'JavaScript',
          framework: 'React',
          files: [],
          fileCount: 0
        }
      })
    })

    render(
      <SessionProvider session={mockSession}>
        <AIProjectGenerator />
      </SessionProvider>
    )

    const promptInput = screen.getByTestId('prompt-input')
    const generateButton = screen.getByTestId('generate-button')

    fireEvent.change(promptInput, { target: { value: 'Create a todo app' } })
    fireEvent.click(generateButton)

    // Check loading state
<<<<<<< HEAD
    await waitFor(() => {
      expect(screen.getByTestId('loading-state')).toBeInTheDocument()
    })

    // Wait for completion and redirect (component has 1500ms delay + mock has 100ms delay)
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workspace/ai-project-123')
    }, { timeout: 5000 })
=======
    expect(screen.getByTestId('loading-state')).toBeInTheDocument()

    // Wait for completion and redirect
    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/workspace/ai-project-123')
    }, { timeout: 3000 })
>>>>>>> a07226e8a (feat: Complete Ralph Loop with 100% test coverage and working unified VM app)
  })

  it('handles initial prompt and auto-start', () => {
    render(
      <SessionProvider session={mockSession}>
        <AIProjectGenerator initialPrompt="Create a blog" autoStart={true} />
      </SessionProvider>
    )
    
    const promptInput = screen.getByTestId('prompt-input')
    expect(promptInput).toHaveValue('Create a blog')
  })

  it('disables generate button when prompt is empty', () => {
    render(
      <SessionProvider session={null}>
        <AIProjectGenerator />
      </SessionProvider>
    )
    
    const generateButton = screen.getByTestId('generate-button')
    expect(generateButton).toBeDisabled()
    
    const promptInput = screen.getByTestId('prompt-input')
    fireEvent.change(promptInput, { target: { value: 'Some prompt' } })
    
    expect(generateButton).not.toBeDisabled()
  })

  it('shows powered by VibeCode AI text', () => {
    render(
      <SessionProvider session={null}>
        <AIProjectGenerator />
      </SessionProvider>
    )
    
    expect(screen.getByText('AI-powered code generation')).toBeInTheDocument()
    expect(screen.getByText(/Powered by/)).toBeInTheDocument()
    expect(screen.getByText(/VibeCode AI/)).toBeInTheDocument()
  })
})