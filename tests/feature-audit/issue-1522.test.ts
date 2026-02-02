import { OpenVSCodeServer } from '@/lib/ide/openvscode';

describe('feature audit: extension support in OpenVSCode adapter', () => {
  it('tracks installed extensions in metadata', async () => {
    const ide = new OpenVSCodeServer();
    const session = await ide.start({
      type: 'openvscode',
      workspaceId: 'ws-extensions',
      userId: 'user-extensions'
    });

    await ide.installExtension?.(session.id, 'ms-python.python');
    const extensions = await ide.listExtensions?.(session.id);

    expect(extensions).toContain('ms-python.python');
  });
});
