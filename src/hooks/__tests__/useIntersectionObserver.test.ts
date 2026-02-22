import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';
import {
  useIntersectionObserver,
  useInView,
  useIntersectionObserverMultiple,
} from '../useIntersectionObserver';

// Mock IntersectionObserver
class MockIntersectionObserver implements IntersectionObserver {
  readonly root: Element | null = null;
  readonly rootMargin: string = '0px';
  readonly thresholds: ReadonlyArray<number> = [0];

  constructor(
    public callback: IntersectionObserverCallback,
    public options?: IntersectionObserverInit
  ) {}

  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn(() => []);
}

// Store the mock instance for manual triggering
let mockIntersectionObserverInstance: MockIntersectionObserver | null = null;

// Helper to trigger intersection
function triggerIntersection(
  isIntersecting: boolean,
  target: Element = document.createElement('div')
) {
  if (!mockIntersectionObserverInstance) return;

  const entry: IntersectionObserverEntry = {
    isIntersecting,
    target,
    boundingClientRect: {} as DOMRectReadOnly,
    intersectionRatio: isIntersecting ? 1 : 0,
    intersectionRect: {} as DOMRectReadOnly,
    rootBounds: null,
    time: Date.now(),
  };

  act(() => {
    mockIntersectionObserverInstance!.callback([entry], mockIntersectionObserverInstance!);
  });
}

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntersectionObserverInstance = null;

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn((callback, options) => {
      mockIntersectionObserverInstance = new MockIntersectionObserver(callback, options);
      return mockIntersectionObserverInstance;
    }) as any;
  });

  afterEach(() => {
    mockIntersectionObserverInstance = null;
  });

  it('returns null initially', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionObserver(ref);
    });

    expect(result.current).toBeNull();
  });

  it('observes element when ref is set', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref);
    });

    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledWith(element);
  });

  it('does not observe when ref is null', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useIntersectionObserver(ref);
    });

    expect(mockIntersectionObserverInstance).toBeNull();
  });

  it('updates entry when intersection changes', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref);
    });

    triggerIntersection(true, element);
    expect(result.current?.isIntersecting).toBe(true);

    triggerIntersection(false, element);
    expect(result.current?.isIntersecting).toBe(false);
  });

  it('passes options to IntersectionObserver', () => {
    const element = document.createElement('div');
    const rootElement = document.createElement('div');
    const options = {
      root: rootElement,
      rootMargin: '10px',
      threshold: 0.5,
    };

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref, options);
    });

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining(options)
    );
  });

  it('freezes state when freezeOnceVisible is true and element becomes visible', () => {
    const element = document.createElement('div');
    const { result, rerender } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref, { freezeOnceVisible: true });
    });

    // Initially null
    expect(result.current).toBeNull();

    // Trigger intersection - element becomes visible
    triggerIntersection(true, element);
    expect(result.current?.isIntersecting).toBe(true);
    expect(mockIntersectionObserverInstance?.disconnect).toHaveBeenCalled();

    // Store the current entry
    const frozenEntry = result.current;

    // Rerender the hook - it should not create a new observer because frozen.current is true
    const observeCallCount = mockIntersectionObserverInstance?.observe.mock.calls.length;
    rerender();

    // Entry should remain the same (frozen)
    expect(result.current).toBe(frozenEntry);
    expect(result.current?.isIntersecting).toBe(true);
  });

  it('does not freeze state when freezeOnceVisible is false', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref, { freezeOnceVisible: false });
    });

    triggerIntersection(true, element);
    expect(result.current?.isIntersecting).toBe(true);

    triggerIntersection(false, element);
    expect(result.current?.isIntersecting).toBe(false);
  });

  it('disconnects observer on unmount', () => {
    const element = document.createElement('div');
    const { unmount } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref);
    });

    const disconnectSpy = mockIntersectionObserverInstance?.disconnect;
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('handles SSR gracefully when IntersectionObserver is undefined', () => {
    const originalIO = global.IntersectionObserver;
    (global as any).IntersectionObserver = undefined;

    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref);
    });

    expect(result.current).toBeNull();

    // Restore
    global.IntersectionObserver = originalIO;
  });

  it('uses default options when none provided', () => {
    const element = document.createElement('div');
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref);
    });

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        root: null,
        rootMargin: '0px',
        threshold: 0,
      })
    );
  });

  it('supports threshold as array', () => {
    const element = document.createElement('div');
    renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useIntersectionObserver(ref, { threshold: [0, 0.5, 1] });
    });

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: [0, 0.5, 1],
      })
    );
  });

  it('recreates observer when options change', () => {
    const element = document.createElement('div');
    const { rerender } = renderHook(
      ({ threshold }) => {
        const ref = useRef<HTMLDivElement>(element);
        return useIntersectionObserver(ref, { threshold });
      },
      { initialProps: { threshold: 0 } }
    );

    const firstInstance = mockIntersectionObserverInstance;
    expect(firstInstance?.disconnect).not.toHaveBeenCalled();

    // Change threshold
    rerender({ threshold: 0.5 });

    // Old observer should be disconnected and new one created
    expect(firstInstance?.disconnect).toHaveBeenCalled();
    expect(global.IntersectionObserver).toHaveBeenCalledTimes(2);
  });
});

describe('useInView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntersectionObserverInstance = null;

    global.IntersectionObserver = jest.fn((callback, options) => {
      mockIntersectionObserverInstance = new MockIntersectionObserver(callback, options);
      return mockIntersectionObserverInstance;
    }) as any;
  });

  afterEach(() => {
    mockIntersectionObserverInstance = null;
  });

  it('returns false initially', () => {
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(null);
      return useInView(ref);
    });

    expect(result.current).toBe(false);
  });

  it('returns true when element is intersecting', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useInView(ref);
    });

    triggerIntersection(true, element);
    expect(result.current).toBe(true);
  });

  it('returns false when element is not intersecting', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useInView(ref);
    });

    triggerIntersection(false, element);
    expect(result.current).toBe(false);
  });

  it('toggles between true and false as intersection changes', () => {
    const element = document.createElement('div');
    const { result } = renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useInView(ref);
    });

    triggerIntersection(true, element);
    expect(result.current).toBe(true);

    triggerIntersection(false, element);
    expect(result.current).toBe(false);

    triggerIntersection(true, element);
    expect(result.current).toBe(true);
  });

  it('accepts options and passes them through', () => {
    const element = document.createElement('div');
    const options = {
      threshold: 0.75,
      rootMargin: '20px',
    };

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(element);
      return useInView(ref, options);
    });

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining(options)
    );
  });
});

describe('useIntersectionObserverMultiple', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIntersectionObserverInstance = null;

    global.IntersectionObserver = jest.fn((callback, options) => {
      mockIntersectionObserverInstance = new MockIntersectionObserver(callback, options);
      return mockIntersectionObserverInstance;
    }) as any;
  });

  afterEach(() => {
    mockIntersectionObserverInstance = null;
  });

  it('returns empty Map initially', () => {
    const { result } = renderHook(() => {
      const refs = [useRef<HTMLDivElement>(null), useRef<HTMLDivElement>(null)];
      return useIntersectionObserverMultiple(refs);
    });

    expect(result.current).toBeInstanceOf(Map);
    expect(result.current.size).toBe(0);
  });

  it('observes multiple elements', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledWith(element1);
    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledWith(element2);
    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledTimes(2);
  });

  it('updates entries for intersecting elements', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    // Trigger intersection for element1
    if (mockIntersectionObserverInstance) {
      const entry1: IntersectionObserverEntry = {
        isIntersecting: true,
        target: element1,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      };

      act(() => {
        mockIntersectionObserverInstance!.callback([entry1], mockIntersectionObserverInstance!);
      });
    }

    expect(result.current.get(element1)?.isIntersecting).toBe(true);
    expect(result.current.has(element2)).toBe(false);
  });

  it('handles freezeOnceVisible for multiple elements', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
      ];
      return useIntersectionObserverMultiple(refs, { freezeOnceVisible: true });
    });

    // Initially empty
    expect(result.current.size).toBe(0);

    // Trigger intersection for element1 (becomes visible)
    if (mockIntersectionObserverInstance) {
      const entry1: IntersectionObserverEntry = {
        isIntersecting: true,
        target: element1,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      };

      act(() => {
        mockIntersectionObserverInstance!.callback([entry1], mockIntersectionObserverInstance!);
      });
    }

    // element1 should be in the map and intersecting
    expect(result.current.get(element1)?.isIntersecting).toBe(true);
    expect(result.current.size).toBe(1);

    // Store the frozen entry for element1
    const frozenEntry1 = result.current.get(element1);

    // Trigger intersection for element2 (becomes visible)
    if (mockIntersectionObserverInstance) {
      const entry2: IntersectionObserverEntry = {
        isIntersecting: true,
        target: element2,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 1,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      };

      act(() => {
        mockIntersectionObserverInstance!.callback([entry2], mockIntersectionObserverInstance!);
      });
    }

    // Both elements should be in the map and intersecting
    expect(result.current.get(element1)?.isIntersecting).toBe(true);
    expect(result.current.get(element2)?.isIntersecting).toBe(true);
    expect(result.current.size).toBe(2);

    // element1's entry should be the same frozen entry (object identity)
    expect(result.current.get(element1)).toBe(frozenEntry1);

    // Try to trigger element1 again (should be ignored because it's frozen)
    if (mockIntersectionObserverInstance) {
      const entry1Again: IntersectionObserverEntry = {
        isIntersecting: false,
        target: element1,
        boundingClientRect: {} as DOMRectReadOnly,
        intersectionRatio: 0,
        intersectionRect: {} as DOMRectReadOnly,
        rootBounds: null,
        time: Date.now(),
      };

      act(() => {
        mockIntersectionObserverInstance!.callback([entry1Again], mockIntersectionObserverInstance!);
      });
    }

    // element1 should still be true and the same entry object (frozen)
    expect(result.current.get(element1)?.isIntersecting).toBe(true);
    expect(result.current.get(element1)).toBe(frozenEntry1);
  });

  it('filters out null refs', () => {
    const element = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(null),
        useRef<HTMLDivElement>(element),
        useRef<HTMLDivElement>(null),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledTimes(1);
    expect(mockIntersectionObserverInstance?.observe).toHaveBeenCalledWith(element);
  });

  it('disconnects observer on unmount', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { unmount } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    const disconnectSpy = mockIntersectionObserverInstance?.disconnect;
    unmount();

    expect(disconnectSpy).toHaveBeenCalled();
  });

  it('handles SSR gracefully when IntersectionObserver is undefined', () => {
    const originalIO = global.IntersectionObserver;
    (global as any).IntersectionObserver = undefined;

    const element1 = document.createElement('div');
    const element2 = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    expect(result.current).toBeInstanceOf(Map);
    expect(result.current.size).toBe(0);

    // Restore
    global.IntersectionObserver = originalIO;
  });

  it('passes options to IntersectionObserver', () => {
    const element = document.createElement('div');
    const options = {
      threshold: [0, 0.5, 1],
      rootMargin: '50px',
    };

    renderHook(() => {
      const refs = [useRef<HTMLDivElement>(element)];
      return useIntersectionObserverMultiple(refs, options);
    });

    expect(global.IntersectionObserver).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({
        threshold: [0, 0.5, 1],
        rootMargin: '50px',
      })
    );
  });

  it('handles multiple simultaneous intersections', () => {
    const element1 = document.createElement('div');
    const element2 = document.createElement('div');
    const element3 = document.createElement('div');

    const { result } = renderHook(() => {
      const refs = [
        useRef<HTMLDivElement>(element1),
        useRef<HTMLDivElement>(element2),
        useRef<HTMLDivElement>(element3),
      ];
      return useIntersectionObserverMultiple(refs);
    });

    // Trigger multiple intersections at once
    if (mockIntersectionObserverInstance) {
      const entries: IntersectionObserverEntry[] = [
        {
          isIntersecting: true,
          target: element1,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 1,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
        {
          isIntersecting: false,
          target: element2,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 0,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
        {
          isIntersecting: true,
          target: element3,
          boundingClientRect: {} as DOMRectReadOnly,
          intersectionRatio: 0.5,
          intersectionRect: {} as DOMRectReadOnly,
          rootBounds: null,
          time: Date.now(),
        },
      ];

      act(() => {
        mockIntersectionObserverInstance!.callback(entries, mockIntersectionObserverInstance!);
      });
    }

    expect(result.current.get(element1)?.isIntersecting).toBe(true);
    expect(result.current.get(element2)?.isIntersecting).toBe(false);
    expect(result.current.get(element3)?.isIntersecting).toBe(true);
    expect(result.current.size).toBe(3);
  });
});
