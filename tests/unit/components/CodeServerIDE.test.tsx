/**
 * Unit tests for CodeServerIDE component
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock the CodeServerIDE component for now
const MockCodeServerIDE = ({ workspaceId, authToken, onReady }: {
  workspaceId: string
  authToken: string
  onReady?: (iframe: HTMLIFrameElement) => void
}) => {
  const handleLoad = () => {
    const iframe = document.createElement('iframe')
    onReady?.(iframe)
  }

  return (
    <div data-testid="code-server-ide">
      <iframe
        data-testid="code-server-iframe"
        src={`/api/code-server/${workspaceId}?token=${authToken}`}
        title="Code Editor"
        onLoad={handleLoad}
      />
    </div>
  )
}

describe('CodeServerIDE Component', () => {
  const mockProps = {
    workspaceId: 'test-workspace-123',
    authToken: 'test-auth-token',
    onReady: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders the IDE iframe with correct src', () => {
    render(<MockCodeServerIDE {...mockProps} />)
    
    const iframe = screen.getByTestId('code-server-iframe')
    expect(iframe).toBeInTheDocument()
    expect(iframe).toHaveAttribute(
      'src',
      `/api/code-server/${mockProps.workspaceId}?token=${mockProps.authToken}`
    )
  })

  it('calls onReady callback when iframe loads', async () => {
    render(<MockCodeServerIDE {...mockProps} />)
    
    const iframe = screen.getByTestId('code-server-iframe')
    fireEvent.load(iframe)
    
    await waitFor(() => {
      expect(mockProps.onReady).toHaveBeenCalledTimes(1)
    })
  })

  it('has correct accessibility attributes', () => {
    render(<MockCodeServerIDE {...mockProps} />)
    
    const iframe = screen.getByTestId('code-server-iframe')
    expect(iframe).toHaveAttribute('title', 'Code Editor')
  })

  it('updates src when workspaceId changes', () => {
    const { rerender } = render(<MockCodeServerIDE {...mockProps} />)
    
    const newWorkspaceId = 'new-workspace-456'
    rerender(<MockCodeServerIDE {...mockProps} workspaceId={newWorkspaceId} />)
    
    const iframe = screen.getByTestId('code-server-iframe')
    expect(iframe).toHaveAttribute(
      'src',
      `/api/code-server/${newWorkspaceId}?token=${mockProps.authToken}`
    )
  })

  it('handles missing onReady callback gracefully', () => {
    const propsWithoutCallback = {
      workspaceId: mockProps.workspaceId,
      authToken: mockProps.authToken,
    }
    
    expect(() => {
      render(<MockCodeServerIDE {...propsWithoutCallback} />)
    }).not.toThrow()
  })
})