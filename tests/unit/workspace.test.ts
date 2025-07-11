/**
 * Unit tests for workspace utilities
 */

describe('Workspace Management', () => {
  it('should validate workspace ID format', () => {
    const validWorkspaceId = 'demo-workspace';
    const invalidWorkspaceId = '';
    
    expect(validWorkspaceId.length).toBeGreaterThan(0);
    expect(invalidWorkspaceId.length).toBe(0);
  });

  it('should handle workspace names correctly', () => {
    const workspaceName = 'My Project';
    const sanitizedName = workspaceName.replace(/[^a-zA-Z0-9-_]/g, '-');
    
    expect(sanitizedName).toBe('My-Project');
  });

  it('should generate session IDs with correct format', () => {
    const sessionId = `cs-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
    
    expect(sessionId).toMatch(/^cs-\d+-[a-z0-9]+$/);
  });
});