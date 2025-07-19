# VibeCode AI: System Prompt & Engineering Guide

**Last Updated**: 2025-07-19
**Owner**: Platform Team

## 1. Core Philosophy & Assumptions (2025 Staff Engineer Perspective)

Our goal is to create a world-class, AI-native development experience. This requires moving beyond simple prompt-and-response and embracing a more sophisticated, structured, and reliable approach to AI integration. My daily reading of Hacker News, tech blogs, and research papers informs these principles.

- **Assumption 1: Models are Fleeting, Architecture is Foundational.** We're currently using `Claude-3.5-Sonnet` via OpenRouter, which is a strong choice for its reasoning and coding capabilities. However, the SOTA model changes quarterly. Our architecture must be model-agnostic, relying on standardized interfaces (like OpenRouter) and structured data (JSON) rather than being tightly coupled to one model's quirks.

- **Assumption 2: Structured I/O is Non-Negotiable.** The era of parsing unstructured markdown from LLMs is over. For reliable, production systems, we must enforce structured outputs. All prompts for project generation MUST require the model to respond in a specific JSON format that our backend can parse and validate directly.

- **Assumption 3: Prompting is a Software Engineering Discipline.** We will treat our prompts like code. They will be version-controlled, reviewed, and updated as we learn more about what works. This document is the canonical source for our core system prompt.

- **Assumption 4: Tool Use is the Future.** While our current flow is monolithic (prompt -> full project), the next iteration will involve the AI calling tools (APIs) to perform sub-tasks, like fetching templates, validating dependencies, or scaffolding components. Our prompting style must evolve to support this.

## 2. The VibeCode AI System Prompt

This is the **canonical system prompt** to be used in the `<system>` block for all project generation requests. It sets the persona, context, constraints, and output format.

```xml
<system>
As an expert cloud-native software architect and senior full-stack developer, your role is to help users create production-ready applications on the VibeCode platform. You are a meticulous planner and a world-class coder, capable of turning a high-level idea into a complete, well-structured, and runnable project.

**Core Directives:**
1.  **Think Step-by-Step:** Before generating code, always use a `<thinking>` block to outline your plan. Detail the technology stack, file structure, key components, and any clarifying assumptions. This plan is for internal review and will not be shown to the user.
2.  **Adhere to the VibeCode Standard:** All generated projects must follow VibeCode's development standards: secure, scalable, observable, and maintainable. This includes generating appropriate configuration for Docker, Kubernetes (if applicable), and a `README.md` with setup instructions.
3.  **Produce Complete, Runnable Projects:** The user expects a complete project, not just snippets. Ensure all necessary files, dependencies (`package.json`, `requirements.txt`, etc.), and boilerplate are included.
4.  **Strictly Adhere to JSON Output:** Your final output MUST be a single JSON object containing a list of file objects. Do not include any text or explanation outside of the JSON structure. Each file object must have two keys: `path` (the full file path, e.g., `src/index.js`) and `content` (the complete file content as a string).

**Example of Final Output Structure:**

```json
{
  "files": [
    {
      "path": "package.json",
      "content": "{\"name\": \"my-react-app\", \"version\": \"0.1.0\", ...}"
    },
    {
      "path": "src/App.js",
      "content": "import React from 'react'; ..."
    }
  ]
}
```

Your expertise and adherence to these rules are critical for providing a seamless and powerful user experience. Do not deviate.
</system>
```

## 3. Prompting Best Practices

- **Use XML Tags:** Claude models are specifically trained to pay attention to XML tags. All user prompts should be wrapped in `<user>` tags, and examples of good interactions should be provided in `<example>` blocks containing both `<user>` and `<assistant>` turns.

- **Few-Shot Prompting:** For complex or nuanced requests, provide 1-2 examples of a high-quality request and the corresponding perfect JSON output. This dramatically improves reliability.

- **Pre-computation and Context Injection:** The backend should pre-process the user's request to inject relevant context into the prompt. For example, if a user wants to use a VibeCode template, the backend should fetch the template's file list and inject it into the prompt as context for the AI.

- **Iterative Refinement:** The AI chat within a workspace should use the existing file structure as context, allowing for iterative refinement rather than starting from scratch each time.

## 4. ✅ COMPLETED: Lovable/Replit/Bolt.diy Flow Implementation

### ACHIEVEMENT: Core Integration Complete

**Solution Delivered**: All pieces integrated with complete workflow:
- ✅ Project templates (15+ templates)
- ✅ Code-server API (`/api/code-server/session`)
- ✅ AI chat interface
- ✅ Kubernetes infrastructure
- ✅ **IMPLEMENTED**: Complete bridge between AI generation and live workspaces

### Implementation Completed (July 18, 2025):

1. **✅ AI Project Generation API**: 
   - Implemented `/api/ai/generate-project` endpoint with OpenRouter/Claude integration
   - Natural language prompts → Complete project structures
   - Automatic code-server workspace creation and file seeding

2. **✅ Live Workspace Integration**:
   - Projects now create live workspaces instead of ZIP downloads
   - "Open in Editor" as primary action in project generation UI
   - Real-time file sync to code-server instances

3. **✅ Complete User Flow**:
   - User provides natural language description
   - AI generates complete project structure  
   - Live workspace automatically provisioned
   - User redirected to live development environment

4. **✅ Components Implemented**:
   - `AIProjectGenerator` component with full UI workflow
   - Enhanced `ProjectScaffolder` with "Open in Editor" primary action
   - Complete test coverage for AI project generation workflow
   - Updated README.md with comprehensive workflow examples

### ✅ Achieved User Flows:
1. **AI Project Generation**: User provides natural language prompt → AI generates project → Live workspace opens
2. **Template Projects**: User selects template → "Open in Editor" → Live workspace with template
3. **In-Workspace AI**: User works in live workspace → AI chat for code modifications

### ✅ Achievement Status:
| Feature | Status |
|---------|--------|
| Templates → Live workspace | ✅ **COMPLETED** |
| AI chat → Generate → Open in editor | ✅ **COMPLETED** |
| Workspace populated with project | ✅ **COMPLETED** |
| Automatic project seeding | ✅ **COMPLETED** |
| Real-time development environment | ✅ **COMPLETED** |

## 5. Development Standards

### Datadog Tagging Strategy
```typescript
const standardTags = {
  env: process.env.NODE_ENV,
  service: 'vibecode-webgui',
  version: process.env.APP_VERSION,
  team: 'platform',
  component: 'api' // Or 'frontend', 'database', etc.
}
```

### Datadog Metric Naming Convention
```
vibecode.{component}.{metric_name}

// Examples:
vibecode.api.response_time
vibecode.frontend.page_load_time
vibecode.backend.database_query_duration
```

### Log Levels
- `ERROR`: System errors requiring immediate attention.
- `WARN`: Degraded performance or recoverable errors.
- `INFO`: Normal operation milestones (e.g., service startup).
- `DEBUG`: Detailed diagnostic information (for staging/dev only).
