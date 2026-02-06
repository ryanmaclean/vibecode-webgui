import { renderHook, act } from '@testing-library/react';

// Mock next/navigation
const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  usePathname: () => '/',
}));

import { useKeyboardShortcuts, shortcutCategories } from '../useKeyboardShortcuts';

function fireKey(key: string, opts: Partial<KeyboardEvent> = {}) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    ...opts,
  });
  document.dispatchEvent(event);
}

describe('useKeyboardShortcuts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns isShortcutsOpen as false initially', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(result.current.isShortcutsOpen).toBe(false);
  });

  it('returns setIsShortcutsOpen function', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    expect(typeof result.current.setIsShortcutsOpen).toBe('function');
  });

  it('toggles shortcuts modal with Cmd+/', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('/', { metaKey: true }));
    expect(result.current.isShortcutsOpen).toBe(true);
    act(() => fireKey('/', { metaKey: true }));
    expect(result.current.isShortcutsOpen).toBe(false);
  });

  it('toggles shortcuts modal with Ctrl+/', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('/', { ctrlKey: true }));
    expect(result.current.isShortcutsOpen).toBe(true);
  });

  it('navigates to /vm on Cmd+T', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('t', { metaKey: true }));
    expect(mockPush).toHaveBeenCalledWith('/vm');
  });

  it('navigates to /editor on Cmd+O', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('o', { metaKey: true }));
    expect(mockPush).toHaveBeenCalledWith('/editor');
  });

  it('navigates to /settings on Cmd+Shift+S', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('S', { metaKey: true, shiftKey: true }));
    expect(mockPush).toHaveBeenCalledWith('/settings');
  });

  it('navigates to /health on Cmd+Shift+H', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('H', { metaKey: true, shiftKey: true }));
    expect(mockPush).toHaveBeenCalledWith('/health');
  });

  it('does not trigger shortcuts without meta/ctrl key', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('t'));
    expect(mockPush).not.toHaveBeenCalled();
    act(() => fireKey('o'));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('does not trigger Cmd+T when shiftKey is held', () => {
    renderHook(() => useKeyboardShortcuts());
    act(() => fireKey('t', { metaKey: true, shiftKey: true }));
    expect(mockPush).not.toHaveBeenCalledWith('/vm');
  });

  it('ignores shortcuts when target is an INPUT element', () => {
    renderHook(() => useKeyboardShortcuts());
    const input = document.createElement('input');
    document.body.appendChild(input);
    const event = new KeyboardEvent('keydown', {
      key: 't',
      metaKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: input });
    act(() => {
      document.dispatchEvent(event);
    });
    expect(mockPush).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('ignores shortcuts when target is a TEXTAREA element', () => {
    renderHook(() => useKeyboardShortcuts());
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    const event = new KeyboardEvent('keydown', {
      key: 'o',
      metaKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: textarea });
    act(() => {
      document.dispatchEvent(event);
    });
    expect(mockPush).not.toHaveBeenCalled();
    document.body.removeChild(textarea);
  });

  it('ignores shortcuts when target is contentEditable', () => {
    renderHook(() => useKeyboardShortcuts());
    // Create a mock target object with isContentEditable = true
    const mockTarget = {
      tagName: 'DIV',
      isContentEditable: true,
    };
    const event = new KeyboardEvent('keydown', {
      key: 't',
      metaKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, 'target', { value: mockTarget });
    act(() => {
      document.dispatchEvent(event);
    });
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('removes event listener on unmount', () => {
    const removeSpy = jest.spyOn(document, 'removeEventListener');
    const { unmount } = renderHook(() => useKeyboardShortcuts());
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('allows manual control of isShortcutsOpen via setIsShortcutsOpen', () => {
    const { result } = renderHook(() => useKeyboardShortcuts());
    act(() => result.current.setIsShortcutsOpen(true));
    expect(result.current.isShortcutsOpen).toBe(true);
    act(() => result.current.setIsShortcutsOpen(false));
    expect(result.current.isShortcutsOpen).toBe(false);
  });
});

describe('shortcutCategories', () => {
  it('is an array of category objects', () => {
    expect(Array.isArray(shortcutCategories)).toBe(true);
    expect(shortcutCategories.length).toBeGreaterThan(0);
  });

  it('contains Global, Navigation, VM Management, and AI Tools categories', () => {
    const names = shortcutCategories.map((c) => c.name);
    expect(names).toContain('Global');
    expect(names).toContain('Navigation');
    expect(names).toContain('VM Management');
    expect(names).toContain('AI Tools');
  });

  it('each category has a name and shortcuts array', () => {
    for (const cat of shortcutCategories) {
      expect(typeof cat.name).toBe('string');
      expect(Array.isArray(cat.shortcuts)).toBe(true);
      expect(cat.shortcuts.length).toBeGreaterThan(0);
    }
  });

  it('each shortcut has keys array and description string', () => {
    for (const cat of shortcutCategories) {
      for (const shortcut of cat.shortcuts) {
        expect(Array.isArray(shortcut.keys)).toBe(true);
        expect(shortcut.keys.length).toBeGreaterThan(0);
        expect(typeof shortcut.description).toBe('string');
      }
    }
  });
});
