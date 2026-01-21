/**
 * Workspace management tools for MCP
 *
 * Integrates with the workspace provisioning services:
 * - Apple Container (local development on macOS)
 * - Kubernetes (production deployment)
 */

import type { CreateWorkspaceArgs } from '../types.js';
import { WorkspaceServiceFactory, type WorkspaceRuntime } from '@/lib/services/workspace-service-factory';

// Template to framework mapping
const templateFrameworkMap: Record<CreateWorkspaceArgs['template'], string> = {
  react: 'react',
  nextjs: 'nextjs',
  nodejs: 'express',
  python: 'flask',
  go: 'go',
  rust: 'actix',
};

// Template to initial files mapping
const templateFiles: Record<CreateWorkspaceArgs['template'], Record<string, string>> = {
  react: {
    'src/App.tsx': `import React from 'react';\n\nexport default function App() {\n  return <div>Hello from VibeCode!</div>;\n}\n`,
    'src/index.tsx': `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './App';\n\nReactDOM.createRoot(document.getElementById('root')!).render(<App />);\n`,
  },
  nextjs: {
    'pages/index.tsx': `export default function Home() {\n  return <main>Hello from VibeCode!</main>;\n}\n`,
  },
  nodejs: {
    'index.js': `const express = require('express');\nconst app = express();\n\napp.get('/', (req, res) => res.send('Hello from VibeCode!'));\n\napp.listen(3000, () => console.log('Server running on port 3000'));\n`,
  },
  python: {
    'app.py': `from flask import Flask\n\napp = Flask(__name__)\n\n@app.route('/')\ndef hello():\n    return 'Hello from VibeCode!'\n\nif __name__ == '__main__':\n    app.run(host='0.0.0.0', port=5000)\n`,
  },
  go: {
    'main.go': `package main\n\nimport (\n\t"fmt"\n\t"net/http"\n)\n\nfunc main() {\n\thttp.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprint(w, "Hello from VibeCode!")\n\t})\n\thttp.ListenAndServe(":8080", nil)\n}\n`,
  },
  rust: {
    'src/main.rs': `use actix_web::{web, App, HttpServer, Responder};\n\nasync fn hello() -> impl Responder {\n    "Hello from VibeCode!"\n}\n\n#[actix_web::main]\nasync fn main() -> std::io::Result<()> {\n    HttpServer::new(|| App::new().route("/", web::get().to(hello)))\n        .bind("0.0.0.0:8080")?\n        .run()\n        .await\n}\n`,
  },
};

// Template to dependencies mapping
const templateDependencies: Record<CreateWorkspaceArgs['template'], string[]> = {
  react: ['react', 'react-dom'],
  nextjs: ['next', 'react', 'react-dom'],
  nodejs: ['express'],
  python: [],
  go: [],
  rust: [],
};

export async function createWorkspace(args: CreateWorkspaceArgs) {
  const { name, template, description } = args;

  try {
    // Check runtime availability
    const runtimeInfo = await WorkspaceServiceFactory.getRuntimeInfo();

    if (!runtimeInfo.available) {
      // Return informative response when no runtime is available
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: false,
                error: 'No workspace runtime available',
                message: 'Please install Apple Container CLI or configure Kubernetes to create workspaces.',
                requestedWorkspace: { name, template, description },
              },
              null,
              2
            ),
          },
        ],
      };
    }

    // Get the appropriate workspace service
    const service = await WorkspaceServiceFactory.getService();
    const projectId = `${name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}-${Date.now()}`;

    // Create the workspace using the provisioning service
    const result = await service.createWorkspace({
      projectId,
      projectName: name,
      framework: templateFrameworkMap[template],
      userId: 'mcp-user', // MCP requests don't have user context
      files: templateFiles[template],
      dependencies: templateDependencies[template],
      environment: description ? { WORKSPACE_DESCRIPTION: description } : {},
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              workspaceId: result.id,
              name,
              template,
              description,
              url: result.url,
              status: result.status,
              runtime: runtimeInfo.runtime,
              message: `Workspace created successfully using ${runtimeInfo.runtime}`,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: 'Failed to create workspace',
              requestedWorkspace: { name, template, description },
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

export async function listWorkspaces() {
  try {
    // Check runtime availability
    const runtimeInfo = await WorkspaceServiceFactory.getRuntimeInfo();

    if (!runtimeInfo.available) {
      return {
        success: false,
        runtime: 'none' as WorkspaceRuntime,
        workspaces: [],
        message: 'No workspace runtime available',
      };
    }

    // Get the appropriate workspace service
    const service = await WorkspaceServiceFactory.getService();
    const workspaces = await service.listWorkspaces();

    // Normalize the response format (Apple Container and K8s have slightly different formats)
    const normalizedWorkspaces = workspaces.map((ws) => ({
      id: ws.id,
      name: ws.id,
      status: ws.status,
      url: ws.url,
    }));

    return {
      success: true,
      runtime: runtimeInfo.runtime,
      workspaces: normalizedWorkspaces,
      features: runtimeInfo.features,
    };
  } catch (error) {
    return {
      success: false,
      workspaces: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function deleteWorkspace(args: { workspaceId: string }) {
  try {
    const runtimeInfo = await WorkspaceServiceFactory.getRuntimeInfo();

    if (!runtimeInfo.available) {
      return {
        success: false,
        message: 'No workspace runtime available',
      };
    }

    const service = await WorkspaceServiceFactory.getService();
    await service.deleteWorkspace(args.workspaceId);

    return {
      success: true,
      message: `Workspace ${args.workspaceId} deleted successfully`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getWorkspaceStatus(args: { workspaceId: string }) {
  try {
    const runtimeInfo = await WorkspaceServiceFactory.getRuntimeInfo();

    if (!runtimeInfo.available) {
      return {
        success: false,
        message: 'No workspace runtime available',
      };
    }

    const service = await WorkspaceServiceFactory.getService();
    const status = await service.getWorkspaceStatus(args.workspaceId);

    if (!status) {
      return {
        success: false,
        message: `Workspace ${args.workspaceId} not found`,
      };
    }

    return {
      success: true,
      workspace: status,
      runtime: runtimeInfo.runtime,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getRuntimeInfo() {
  return WorkspaceServiceFactory.getRuntimeInfo();
}
