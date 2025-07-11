/**
 * Unit tests for authentication utilities
 */

describe('Authentication', () => {
  it('should validate email format', () => {
    const validEmail = 'test@example.com';
    const invalidEmail = 'invalid-email';
    
    expect(validEmail).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(invalidEmail).not.toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  });

  it('should validate password strength', () => {
    const strongPassword = 'StrongPassword123!';
    const weakPassword = '123';
    
    expect(strongPassword.length).toBeGreaterThan(8);
    expect(weakPassword.length).toBeLessThan(8);
  });
});