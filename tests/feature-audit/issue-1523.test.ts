import { OpenVSCodeServer } from '@/lib/ide/openvscode';

describe('feature audit: automatic workspace loading', () => {
  it('defaults projectPath to /workspace when not provided', async () => {
    const ide = new OpenVSCodeServer();
    const session = await ide.start({
      type: 'openvscode',
      workspaceId: 'ws-default',
      userId: 'user-default'
    });

    expect(session.metadata?.projectPath).toBe('/workspace');
  });
});
