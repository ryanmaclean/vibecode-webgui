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
    title: 'Lovable Clone – Sprint Plan',
    description: 'Plans a one-week sprint to replicate Lovable.ai features with focus on AI pair programming UX.',
    useCase: 'Product Planning',
    prompt: `You are the AI engineering lead for a Lovable.ai style application hosted on Azure.
Create a 7 day sprint plan that delivers:
- Next.js 15 web UI with lovable-inspired onboarding and code editor UX
- Retrieval-augmented chat powered by PostgreSQL + pgvector
- Azure Datadog monitoring covering DBM first, LLM observability second
Outline user stories, acceptance criteria, and dependencies per day.
Highlight checkpoints that require Datadog dashboard validation.`,
    contextExamples: [
      'We already have an AKS cluster and Azure Container Registry ready.',
      'Datadog API and APP keys are stored in Key Vault; instrumentation must stay agentless compatible.',
      'Customers expect lovable-style template prompts to accelerate onboarding.'
    ]
  },
  {
    id: 'rag-debugging-session',
    title: 'RAG Debugging Session',
    description: 'Guides an engineer through validating vector chunks and Datadog DBM signals after ingestion.',
    useCase: 'Operational Runbook',
    prompt: `Act as a senior SRE walking a teammate through verifying our Lovable.ai clone.
Steps must cover:
1. Ingesting demo files via /api/ai/upload and confirming rag_chunks rows in PostgreSQL.
2. Running Datadog DBM checks to confirm pgvector metrics and custom queries are visible.
3. Triggering an /api/ai/chat request with workspace context and verifying logs + LLM spans.
Return the instructions as bullet points with shell commands and Datadog dashboards to open.`,
    contextExamples: [
      'Vector ingestion script: scripts/generate-vector-activity.sh',
      'Datadog dashboards expected: "PostgreSQL pgvector Overview" and "LLM Observability".',
      'Workspace slug used in demos: lovable-demo.'
    ]
  },
  {
    id: 'demo-script',
    title: 'Conference Demo Script',
    description: 'Produces a narrated flow for the Azure + Datadog + pgvector showcase.',
    useCase: 'Presentations',
    prompt: `Create a 5 minute narrated walkthrough for our Lovable.ai clone running on Azure. The flow should:
- Start with the Lovable-inspired UI and highlight the template marketplace.
- Upload a sample repo, show vector chunking, and retrieve context in the chat panel.
- Pivot to Datadog: DBM views for pgvector, then LLM observability spans triggered by the chat.
- Conclude with a cost optimization callout (autoscale to zero user pool, start/stop AKS).
Include speaker notes and timing marks.`
  }
]
