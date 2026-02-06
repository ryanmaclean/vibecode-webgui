import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

const mockBack = jest.fn();

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack }),
  usePathname: () => '/settings',
}));

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Download: (props: any) => <svg data-testid="download-icon" {...props} />,
  Upload: (props: any) => <svg data-testid="upload-icon" {...props} />,
  RotateCcw: (props: any) => <svg data-testid="rotate-icon" {...props} />,
  Wand2: (props: any) => <svg data-testid="wand-icon" {...props} />,
}));

// Mock OnboardingDrawer component
jest.mock('@/components/onboarding/OnboardingDrawer', () => ({
  OnboardingDrawer: (props: any) => (
    <div data-testid="onboarding-drawer" />
  ),
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

// Mock Button to a simple button element
jest.mock('@/components/ui/button', () => ({
  Button: function MockButton(props: any) {
    const { children, asChild, variant, size, className, ...rest } = props;
    return require('react').createElement('button', rest, children);
  },
}));

// Mock settings manager
const mockGetAll = jest.fn(() => ({
  general: { theme: 'system' },
  services: {},
  ai: {},
  advanced: {},
  lastModified: Date.now(),
}));
const mockSetAll = jest.fn();
const mockSave = jest.fn(() => Promise.resolve());

jest.mock('@/lib/settings/settings-manager', () => ({
  getSettingsManager: () => ({
    getAll: mockGetAll,
    setAll: mockSetAll,
    save: mockSave,
  }),
}));

jest.mock('@/types/settings', () => ({
  DEFAULT_APP_SETTINGS: {
    general: { theme: 'system' },
    services: {},
    ai: {},
    advanced: {},
    lastModified: 0,
  },
}));

import SettingsPage from '../page';

describe('SettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
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

  it('renders Export Settings button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Export Settings')).toBeInTheDocument();
  });

  it('renders Import Settings button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Import Settings')).toBeInTheDocument();
  });

  it('renders Reset to Defaults button', () => {
    render(<SettingsPage />);
    expect(screen.getByText('Reset to Defaults')).toBeInTheDocument();
  });

  it('renders hidden file input for import', () => {
    render(<SettingsPage />);
    const fileInput = screen.getByLabelText('Import settings file');
    expect(fileInput).toBeInTheDocument();
    expect(fileInput).toHaveAttribute('type', 'file');
    expect(fileInput).toHaveAttribute('accept', '.json');
    expect(fileInput).toHaveClass('hidden');
  });

  it('calls getAll on Export click', () => {
    // Mock URL methods for blob download
    const createObjectURLMock = jest.fn(() => 'blob:test');
    const revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Export Settings'));

    expect(mockGetAll).toHaveBeenCalled();
    expect(createObjectURLMock).toHaveBeenCalled();
  });

  it('resets settings to defaults on confirmation', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Reset to Defaults'));
    expect(confirmSpy).toHaveBeenCalledWith('Reset all settings to defaults?');
    expect(mockSetAll).toHaveBeenCalled();
    expect(mockSave).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it('does not reset when confirmation is cancelled', () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText('Reset to Defaults'));
    expect(confirmSpy).toHaveBeenCalled();
    expect(mockSetAll).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});
