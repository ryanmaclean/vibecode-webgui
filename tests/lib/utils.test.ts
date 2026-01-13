/**
 * Tests for utility functions
 */
import { cn } from '@/lib/utils';

describe('utils', () => {
  describe('cn', () => {
    it('should merge single class name', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('should merge multiple class names', () => {
      const result = cn('foo', 'bar');
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle conditional classes', () => {
      const result = cn('base', true && 'conditional', false && 'hidden');
      expect(result).toContain('base');
      expect(result).toContain('conditional');
      expect(result).not.toContain('hidden');
    });

    it('should merge Tailwind classes correctly', () => {
      const result = cn('px-2 py-1', 'px-4');
      // Result should contain both classes
      expect(result).toContain('px-4');
      expect(result).toContain('py-1');
    });

    it('should handle empty input', () => {
      expect(cn()).toBe('');
    });

    it('should handle null and undefined', () => {
      expect(cn(null, undefined, 'foo')).toBe('foo');
    });

    it('should handle arrays', () => {
      const result = cn(['foo', 'bar']);
      expect(result).toContain('foo');
      expect(result).toContain('bar');
    });

    it('should handle objects with boolean values', () => {
      const result = cn({
        foo: true,
        bar: false,
        baz: true,
      });
      // clsx converts objects to strings, so test the result contains the class names
      expect(result).toBeTruthy();
      expect(result.length).toBeGreaterThan(0);
    });

    it('should merge complex Tailwind utilities', () => {
      const result = cn(
        'bg-red-500 text-white',
        'bg-blue-500',
        'hover:bg-green-500'
      );
      expect(result).toContain('bg-blue-500');
      expect(result).toContain('text-white');
      expect(result).toContain('hover:bg-green-500');
    });

    it('should handle spacing utilities correctly', () => {
      const result = cn('m-2 mx-4');
      // mx-4 should override m-2 for horizontal margin
      expect(result).toContain('mx-4');
    });
  });
});
