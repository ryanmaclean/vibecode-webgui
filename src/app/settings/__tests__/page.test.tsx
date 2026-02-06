import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockBack = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  usePathname: () => '/settings',
}));

// Mock SettingsPanel component
jest.mock('@/components/settings/SettingsPanel', () => ({
  SettingsPanel: (props: any) => (
    <div data-testid="settings-panel">
      <button data-testid="save-btn" onClick={() => props.onSave({ lastModified: new Date() })}>
        Save
      </button>
      <button data-testid="close-btn" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));

import SettingsPage from '../page';

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
  });

  it('renders SettingsPanel component', () => {
    render(<SettingsPage />);
    expect(screen.getByTestId('settings-panel')).toBeInTheDocument();
    expect(screen.getByTestId('save-btn')).toBeInTheDocument();
    expect(screen.getByTestId('close-btn')).toBeInTheDocument();
  });

  it('calls router.back when close is triggered', () => {
    render(<SettingsPage />);
    const closeBtn = screen.getByTestId('close-btn');
    closeBtn.click();
    expect(mockBack).toHaveBeenCalled();
  });

  it('handles save without errors', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    render(<SettingsPage />);
    const saveBtn = screen.getByTestId('save-btn');
    saveBtn.click();
    expect(consoleSpy).toHaveBeenCalledWith('Settings saved:', expect.anything());
    consoleSpy.mockRestore();
  });
});
