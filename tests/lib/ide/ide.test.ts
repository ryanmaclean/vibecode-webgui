/**
 * IDE Abstraction Layer Tests
 */

import { 
  IDEFactory,
  OpenVSCodeServer,
  CodeServer,
  EclipseTheia,
  IDEType,
  IDEConfig,
} from '@/lib/ide';

describe('IDE Abstraction Layer', () => {
  beforeEach(() => {
    // Clear IDE instances between tests
    IDEFactory.clearInstances();
  });

  describe('IDEFactory', () => {
    it('should return default IDE type', () => {
      const defaultType = IDEFactory.getDefaultIDEType();
      expect(defaultType).toBeDefined();
      expect(['openvscode', 'code-server', 'theia']).toContain(defaultType);
    });

    it('should get IDE instance by type', () => {
      const openvsIDE = IDEFactory.getIDE('openvscode');
      const codeserverIDE = IDEFactory.getIDE('code-server');
      const theiaIDE = IDEFactory.getIDE('theia');

      expect(openvsIDE.name).toBe('openvscode');
      expect(codeserverIDE.name).toBe('code-server');
      expect(theiaIDE.name).toBe('theia');
    });

    it('should return same instance on multiple calls (singleton)', () => {
      const ide1 = IDEFactory.getIDE('openvscode');
      const ide2 = IDEFactory.getIDE('openvscode');
      
      expect(ide1).toBe(ide2);
    });

    it('should list all available IDEs', () => {
      const available = IDEFactory.getAvailableIDEs();
      expect(available).toEqual(['openvscode', 'code-server', 'theia']);
    });

    it('should throw error for unsupported IDE type', () => {
      expect(() => {
        IDEFactory.getIDE('invalid-ide' as IDEType);
      }).toThrow('Unsupported IDE type');
    });
  });

  describe('OpenVSCodeServer', () => {
    let ide: OpenVSCodeServer;
    const config: IDEConfig = {
      type: 'openvscode',
      workspaceId: 'test-workspace',
      userId: 'test-user',
    };

    beforeEach(() => {
      ide = new OpenVSCodeServer();
    });

    it('should have correct name', () => {
      expect(ide.name).toBe('openvscode');
    });

    it('should start a session', async () => {
      const session = await ide.start(config);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('openvscode');
      expect(session.status).toBe('starting');
      expect(session.workspaceId).toBe('test-workspace');
      expect(session.userId).toBe('test-user');
      expect(session.url).toContain('http://localhost');
    });

    it('should get session by ID', async () => {
      const createdSession = await ide.start(config);
      const retrievedSession = await ide.getSession(createdSession.id);

      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.id).toBe(createdSession.id);
    });

    it('should stop a session', async () => {
      const session = await ide.start(config);
      await ide.stop(session.id);

      const stoppedSession = await ide.getSession(session.id);
      expect(stoppedSession?.status).toBe('stopped');
    });

    it('should perform health check', async () => {
      const session = await ide.start(config);
      const health = await ide.healthCheck(session.id);

      expect(health).toBeDefined();
      expect(health.status).toBeDefined();
      expect(health.timestamp).toBeInstanceOf(Date);
    });

    it('should install extensions', async () => {
      const session = await ide.start(config);
      await ide.installExtension!(session.id, 'ms-python.python');

      const extensions = await ide.listExtensions!(session.id);
      expect(extensions).toContain('ms-python.python');
    });

    it('should get session URL', async () => {
      const session = await ide.start(config);
      const url = await ide.getURL(session.id);

      expect(url).toBe(session.url);
      expect(url).toContain('http://localhost');
    });
  });

  describe('CodeServer', () => {
    let ide: CodeServer;
    const config: IDEConfig = {
      type: 'code-server',
      workspaceId: 'test-workspace',
      userId: 'test-user',
      auth: {
        enabled: true,
        password: 'test-password',
      },
    };

    beforeEach(() => {
      ide = new CodeServer();
    });

    it('should have correct name', () => {
      expect(ide.name).toBe('code-server');
    });

    it('should start a session with auth', async () => {
      const session = await ide.start(config);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('code-server');
      expect(session.metadata?.auth).toBeDefined();
    });

    it('should use default port 8080', async () => {
      const session = await ide.start(config);
      expect(session.url).toContain(':8080');
    });
  });

  describe('EclipseTheia', () => {
    let ide: EclipseTheia;
    const config: IDEConfig = {
      type: 'theia',
      workspaceId: 'test-workspace',
      userId: 'test-user',
    };

    beforeEach(() => {
      ide = new EclipseTheia();
    });

    it('should have correct name', () => {
      expect(ide.name).toBe('theia');
    });

    it('should start a session', async () => {
      const session = await ide.start(config);

      expect(session.id).toBeDefined();
      expect(session.type).toBe('theia');
      expect(session.status).toBe('starting');
    });

    it('should use default port 3000', async () => {
      const session = await ide.start(config);
      expect(session.url).toContain(':3000');
    });
  });

  describe('IDE Capabilities', () => {
    it('should export IDE capabilities', async () => {
      const { IDE_CAPABILITIES } = await import('@/lib/ide/types');
      
      expect(IDE_CAPABILITIES.openvscode).toBeDefined();
      expect(IDE_CAPABILITIES['code-server']).toBeDefined();
      expect(IDE_CAPABILITIES.theia).toBeDefined();

      expect(IDE_CAPABILITIES.openvscode.features.builtInAuth).toBe(false);
      expect(IDE_CAPABILITIES['code-server'].features.builtInAuth).toBe(true);
      expect(IDE_CAPABILITIES.theia.features.customization).toBe('high');
    });
  });
});
