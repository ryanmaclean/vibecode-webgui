import { renderHook, act } from '@testing-library/react';
import { useLocalStorage, useLocalStorageCustom } from '../useLocalStorage';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useLocalStorage', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('returns initialValue when localStorage is empty', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
  });

  it('returns stored value when localStorage contains data', () => {
    localStorageMock.setItem('test-key', JSON.stringify('stored-value'));
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('stored-value');
  });

  it('returns initialValue when localStorage contains invalid JSON', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    localStorageMock.setItem('test-key', 'invalid-json');
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    expect(result.current[0]).toBe('initial');
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error reading localStorage key "test-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('setValue updates state', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('new-value');
    });
    expect(result.current[0]).toBe('new-value');
  });

  it('setValue persists to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('new-value');
    });
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify('new-value')
    );
  });

  it('setValue works with function updater', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 5));
    act(() => {
      result.current[1]((prev) => prev + 10);
    });
    expect(result.current[0]).toBe(15);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify(15)
    );
  });

  it('setValue handles complex objects', () => {
    interface UserPrefs {
      theme: string;
      fontSize: number;
    }
    const initialPrefs: UserPrefs = { theme: 'light', fontSize: 14 };
    const { result } = renderHook(() =>
      useLocalStorage<UserPrefs>('prefs', initialPrefs)
    );

    const newPrefs: UserPrefs = { theme: 'dark', fontSize: 16 };
    act(() => {
      result.current[1](newPrefs);
    });

    expect(result.current[0]).toEqual(newPrefs);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'prefs',
      JSON.stringify(newPrefs)
    );
  });

  it('setValue handles errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    localStorageMock.setItem.mockImplementationOnce(() => {
      throw new Error('QuotaExceededError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('new-value');
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error setting localStorage key "test-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('removeValue clears localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('new-value');
    });
    act(() => {
      result.current[2]();
    });
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('test-key');
  });

  it('removeValue resets to initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[1]('new-value');
    });
    act(() => {
      result.current[2]();
    });
    expect(result.current[0]).toBe('initial');
  });

  it('removeValue handles errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    localStorageMock.removeItem.mockImplementationOnce(() => {
      throw new Error('RemoveError');
    });

    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));
    act(() => {
      result.current[2]();
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error removing localStorage key "test-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('synchronizes value when storage event fires', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: JSON.stringify('updated-from-another-tab'),
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(result.current[0]).toBe('updated-from-another-tab');
  });

  it('resets to initialValue when storage event has null newValue', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('current-value');
    });

    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: null,
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(result.current[0]).toBe('initial');
  });

  it('ignores storage events for different keys', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    act(() => {
      result.current[1]('current-value');
    });

    const storageEvent = new StorageEvent('storage', {
      key: 'other-key',
      newValue: JSON.stringify('other-value'),
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(result.current[0]).toBe('current-value');
  });

  it('handles invalid JSON in storage events gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const { result } = renderHook(() => useLocalStorage('test-key', 'initial'));

    const storageEvent = new StorageEvent('storage', {
      key: 'test-key',
      newValue: 'invalid-json',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing localStorage value for key "test-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('removes storage event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useLocalStorage('test-key', 'initial'));
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );
    removeEventListenerSpy.mockRestore();
  });

  it('handles array values correctly', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', [1, 2, 3]));
    expect(result.current[0]).toEqual([1, 2, 3]);

    act(() => {
      result.current[1]([4, 5, 6]);
    });

    expect(result.current[0]).toEqual([4, 5, 6]);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify([4, 5, 6])
    );
  });

  it('handles boolean values correctly', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', false));
    expect(result.current[0]).toBe(false);

    act(() => {
      result.current[1](true);
    });

    expect(result.current[0]).toBe(true);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify(true)
    );
  });

  it('handles number values correctly', () => {
    const { result } = renderHook(() => useLocalStorage('test-key', 0));
    expect(result.current[0]).toBe(0);

    act(() => {
      result.current[1](42);
    });

    expect(result.current[0]).toBe(42);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'test-key',
      JSON.stringify(42)
    );
  });
});

describe('useLocalStorageCustom', () => {
  beforeEach(() => {
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  it('uses custom serializer and deserializer', () => {
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => new Date(str);

    const testDate = new Date('2024-01-01T00:00:00.000Z');

    const { result } = renderHook(() =>
      useLocalStorageCustom('date-key', testDate, serializer, deserializer)
    );

    expect(result.current[0]).toEqual(testDate);
  });

  it('setValue uses custom serializer', () => {
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => new Date(str);

    const initialDate = new Date('2024-01-01T00:00:00.000Z');
    const newDate = new Date('2024-12-31T23:59:59.999Z');

    const { result } = renderHook(() =>
      useLocalStorageCustom('date-key', initialDate, serializer, deserializer)
    );

    act(() => {
      result.current[1](newDate);
    });

    expect(result.current[0]).toEqual(newDate);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'date-key',
      newDate.toISOString()
    );
  });

  it('reads stored value using custom deserializer', () => {
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => new Date(str);

    const storedDate = new Date('2024-06-15T12:00:00.000Z');
    localStorageMock.setItem('date-key', storedDate.toISOString());

    const { result } = renderHook(() =>
      useLocalStorageCustom(
        'date-key',
        new Date('2024-01-01T00:00:00.000Z'),
        serializer,
        deserializer
      )
    );

    expect(result.current[0]).toEqual(storedDate);
  });

  it('setValue works with function updater', () => {
    const serializer = (num: number) => `custom-${num}`;
    const deserializer = (str: string) => parseInt(str.replace('custom-', ''), 10);

    const { result } = renderHook(() =>
      useLocalStorageCustom('num-key', 5, serializer, deserializer)
    );

    act(() => {
      result.current[1]((prev) => prev + 10);
    });

    expect(result.current[0]).toBe(15);
    expect(localStorageMock.setItem).toHaveBeenCalledWith('num-key', 'custom-15');
  });

  it('removeValue resets to initialValue', () => {
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => new Date(str);

    const initialDate = new Date('2024-01-01T00:00:00.000Z');

    const { result } = renderHook(() =>
      useLocalStorageCustom('date-key', initialDate, serializer, deserializer)
    );

    act(() => {
      result.current[1](new Date('2024-12-31T23:59:59.999Z'));
    });

    act(() => {
      result.current[2]();
    });

    expect(result.current[0]).toEqual(initialDate);
    expect(localStorageMock.removeItem).toHaveBeenCalledWith('date-key');
  });

  it('synchronizes with custom deserializer on storage event', () => {
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => new Date(str);

    const { result } = renderHook(() =>
      useLocalStorageCustom(
        'date-key',
        new Date('2024-01-01T00:00:00.000Z'),
        serializer,
        deserializer
      )
    );

    const updatedDate = new Date('2024-12-31T23:59:59.999Z');
    const storageEvent = new StorageEvent('storage', {
      key: 'date-key',
      newValue: updatedDate.toISOString(),
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(result.current[0]).toEqual(updatedDate);
  });

  it('handles deserialization errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => {
      throw new Error('Deserialization failed');
    };

    localStorageMock.setItem('date-key', 'some-value');

    const initialDate = new Date('2024-01-01T00:00:00.000Z');
    const { result } = renderHook(() =>
      useLocalStorageCustom('date-key', initialDate, serializer, deserializer)
    );

    expect(result.current[0]).toEqual(initialDate);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error reading localStorage key "date-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('handles storage event deserialization errors gracefully', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const serializer = (date: Date) => date.toISOString();
    const deserializer = (str: string) => {
      if (str === 'invalid') {
        throw new Error('Invalid format');
      }
      return new Date(str);
    };

    const { result } = renderHook(() =>
      useLocalStorageCustom(
        'date-key',
        new Date('2024-01-01T00:00:00.000Z'),
        serializer,
        deserializer
      )
    );

    const storageEvent = new StorageEvent('storage', {
      key: 'date-key',
      newValue: 'invalid',
    });

    act(() => {
      window.dispatchEvent(storageEvent);
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error parsing localStorage value for key "date-key"'),
      expect.any(Error)
    );
    consoleWarnSpy.mockRestore();
  });

  it('removes storage event listener on unmount', () => {
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
    const serializer = (val: string) => val;
    const deserializer = (val: string) => val;

    const { unmount } = renderHook(() =>
      useLocalStorageCustom('test-key', 'initial', serializer, deserializer)
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'storage',
      expect.any(Function)
    );
    removeEventListenerSpy.mockRestore();
  });

  it('handles Map objects with custom serialization', () => {
    const serializer = (map: Map<string, number>) => JSON.stringify([...map]);
    const deserializer = (str: string) => new Map<string, number>(JSON.parse(str));

    const initialMap = new Map<string, number>([['a', 1], ['b', 2]]);

    const { result } = renderHook(() =>
      useLocalStorageCustom('map-key', initialMap, serializer, deserializer)
    );

    const newMap = new Map<string, number>([['c', 3], ['d', 4]]);

    act(() => {
      result.current[1](newMap);
    });

    expect(result.current[0]).toEqual(newMap);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'map-key',
      JSON.stringify([...newMap])
    );
  });
});
