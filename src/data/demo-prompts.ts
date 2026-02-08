export interface DemoPrompt {
  id: string
  title: string
  description: string
  useCase: string
  prompt: string
  contextExamples?: string[]
}

export const DEMO_PROMPTS: DemoPrompt[] = [
  {
    id: 'lovable-app-sprint-plan',
    title: 'Lovable App Sprint Plan',
    description: 'Create a detailed sprint plan for a Lovable-style rapid application builder with AI-driven scaffolding.',
    useCase: 'Product Planning',
    prompt:
      'Act as a senior product manager for a Lovable-style AI app builder. Create a 2-week sprint plan that outlines milestones for building a full-stack web app scaffolding tool. Include Azure DevOps integration for CI/CD, Datadog observability hooks, and a Lovable-inspired natural language project generation flow. Return the plan as a structured markdown document with user stories, acceptance criteria, and estimated story points.',
    contextExamples: [
      'Sprint planning for rapid prototyping tools',
      'AI-driven code generation workflows',
    ],
  },
  {
    id: 'rag-debugging-session',
    title: 'RAG Pipeline Debugging Runbook',
    description: 'A step-by-step operational runbook for debugging RAG pipeline issues in production.',
    useCase: 'Operational Runbook',
    prompt:
      'Act as a senior SRE and guide me through debugging a RAG (Retrieval-Augmented Generation) pipeline that is returning irrelevant results. The pipeline uses Azure OpenAI embeddings, a Postgres pgvector store, and Datadog for monitoring. Outline the diagnostic steps, relevant Datadog dashboards to check, common failure modes, and remediation actions. Produce a runbook-style document with numbered steps.',
    contextExamples: [
      'RAG pipeline observability with Datadog',
      'Azure OpenAI embedding troubleshooting',
    ],
  },
  {
    id: 'demo-script',
    title: 'Product Demo Script',
    description: 'Generate a polished demo script for presenting the AI-powered development platform.',
    useCase: 'Presentations',
    prompt:
      'Create a 10-minute product demo script for presenting an AI-powered development platform to enterprise prospects. The demo should highlight Azure deployment, Datadog integration for real-time monitoring, a Lovable-inspired project generation experience, and multi-model AI routing via OpenRouter. Plan the narrative arc, key talking points, and live demo checkpoints. Return the script with speaker notes and timing cues.',
    contextExamples: [
      'Enterprise SaaS demo best practices',
      'AI platform value proposition framing',
    ],
  },
]
