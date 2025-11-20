# VibeCode Platform Demos

Comprehensive collection of demos showcasing VibeCode's AI, database, and monitoring capabilities.

## 📁 Demo Categories

### 🤖 CrewAI Multi-Agent Workflows

Demonstrations of multi-agent AI orchestration using CrewAI framework.

#### **crewai-4-agent-openai-workflow.py** ⭐ Production-Ready
Production-quality demo with real OpenAI API calls and complete Datadog tracing.

**Purpose:** Showcase production-ready multi-agent workflow with different GPT models
**Agents:** 4 (Research, Bootloader, Service, QA)
**Models:** GPT-4, GPT-3.5-turbo, GPT-4o-mini
**Cost:** ~$0.10-0.50 per run (real OpenAI calls)
**Monitoring:** Full Datadog LLM Observability with I/O capture

**When to use:**
- Testing complete CrewAI workflows
- Demonstrating multi-model orchestration
- Production pattern validation
- Datadog LLM Obs capability demos

**Run:**
```bash
export OPENAI_API_KEY=sk-...
export DD_API_KEY=...
python demos/crewai-4-agent-openai-workflow.py
```

**View results:** [Datadog LLM Traces](https://app.datadoghq.com/llm/traces) → Search: `ml_app:vibecode-crewai-working`

---

#### **crewai-vm-management-demo.py** 💡 Educational
Free educational demo showing agent patterns without API costs.

**Purpose:** Learn CrewAI patterns without making expensive API calls
**Agents:** 4 (VZ Research, Bootloader, Service, QA)
**Models:** None (uses CrewAI built-in logic)
**Cost:** FREE (no LLM calls)
**Monitoring:** Automatic Datadog integration

**When to use:**
- Learning CrewAI framework
- Testing Datadog integration setup
- Prototyping agent workflows
- Cost-free demonstrations

**Run:**
```bash
export DD_API_KEY=...
ddtrace-run python demos/crewai-vm-management-demo.py
```

**View results:** [Datadog LLM Traces](https://app.datadoghq.com/llm/traces) → Search: `ml_app:vibecode-crewai-demo`

---

### 📊 Datadog Monitoring & Observability

Demonstrations of Datadog APM and LLM Observability integration.

#### **datadog-llmobs-agentless-proof.py** ✅ Verified Working
Minimal proof-of-concept that Datadog LLM Obs works in agentless mode.

**Purpose:** Verify Datadog integration with simplest possible test
**Status:** ✓ VERIFIED - November 18, 2025 (see VERIFIED_WORKING.md)
**Cost:** FREE (no LLM calls)
**Mode:** Agentless (direct to Datadog API)

**When to use:**
- First-time setup verification
- Troubleshooting trace delivery
- Testing API keys and configuration
- Proving integration works

**Run:**
```bash
export DD_API_KEY=...
python demos/datadog-llmobs-agentless-proof.py
```

**View results:** [Datadog LLM Traces](https://app.datadoghq.com/llm/traces) → Search: `ml_app:vibecode-agentless-proof`

---

#### **datadog-ddtrace-basic-test.py** 🔧 Basic Test
Tests basic dd-trace APM instrumentation.

**Purpose:** Verify dd-trace installation and basic APM connectivity
**Cost:** FREE
**Features:** Basic function tracing, service tagging

**When to use:**
- Verifying dd-trace installation
- Testing basic APM connectivity
- Before setting up LLM Obs

**Run:**
```bash
export DD_API_KEY=...  # or have Datadog Agent running
ddtrace-run python demos/datadog-ddtrace-basic-test.py
```

**View results:** [Datadog APM](https://app.datadoghq.com/apm/traces) → Service: `vibecode-demo`

---

#### **datadog-llmobs-io-capture-test.py** 📝 I/O Testing
Tests prompt and response capture in Datadog traces.

**Purpose:** Verify LLM input/output visibility in Datadog UI
**Cost:** ~$0.01 (one simple OpenAI call)
**Features:** Input/output annotation, metadata capture

**When to use:**
- Verifying content capture
- Testing LLMObs.annotate() usage
- Debugging missing content in traces

**Run:**
```bash
export OPENAI_API_KEY=sk-...
export DD_API_KEY=...
python demos/datadog-llmobs-io-capture-test.py
```

**View results:** [Datadog LLM Traces](https://app.datadoghq.com/llm/traces) → Search: `ml_app:vibecode-input-output-test`

---

### 🗄️ PostgreSQL + pgvector Demos

Vector database and GenAI integration demonstrations.

#### **postgresql-pgvector-demo.cjs**
JavaScript demo of pgvector for semantic search.

**Purpose:** Demonstrate vector embeddings and similarity search
**Technology:** PostgreSQL + pgvector extension, Node.js
**Features:** Document embedding, semantic search, vector operations

**Run:**
```bash
node demos/postgresql-pgvector-demo.cjs
```

---

#### **postgresql-genai-workflow.ts**
TypeScript workflow for GenAI with PostgreSQL.

**Purpose:** Complete GenAI workflow with vector storage
**Technology:** PostgreSQL, pgvector, TypeScript
**Features:** Embedding generation, vector storage, retrieval

**Run:**
```bash
npx tsx demos/postgresql-genai-workflow.ts
```

---

#### **postgresql-genai-setup.sh**
Automated PostgreSQL + GenAI environment setup.

**Purpose:** One-command setup of PostgreSQL with pgvector and GenAI tools
**Technology:** Bash, Docker, PostgreSQL
**Features:** Database initialization, extension setup, sample data

**Run:**
```bash
chmod +x demos/postgresql-genai-setup.sh
./demos/postgresql-genai-setup.sh
```

---

#### **pgvector-web-interface.html**
Web UI for pgvector demonstrations.

**Purpose:** Interactive browser-based vector search demo
**Technology:** HTML, JavaScript, PostgreSQL API
**Features:** Visual vector search, embedding visualization

**Open:**
```bash
open demos/pgvector-web-interface.html
```

---

## 🚀 Quick Start

### Prerequisites

**Python demos:**
```bash
pip install -r demos/requirements.txt
```

**JavaScript/TypeScript demos:**
```bash
npm install
```

### Environment Variables

**For Datadog demos:**
```bash
export DD_API_KEY=<your-api-key>
export DD_SITE=datadoghq.com  # Optional, defaults to datadoghq.com
```

**For AI demos with OpenAI:**
```bash
export OPENAI_API_KEY=sk-your-openai-key
```

**For PostgreSQL demos:**
```bash
export PGHOST=localhost
export PGPORT=5432
export PGDATABASE=workspace_rag
export PGUSER=postgres
export PGPASSWORD=your-password
```

---

## 📋 Demo Selection Guide

### "I want to verify Datadog integration works"
→ Start with: **datadog-llmobs-agentless-proof.py** (simplest, verified working)

### "I want to test CrewAI without spending money"
→ Use: **crewai-vm-management-demo.py** (free, no API calls)

### "I want to see a production-ready AI workflow"
→ Run: **crewai-4-agent-openai-workflow.py** (costs ~$0.10-0.50)

### "I want to test vector database functionality"
→ Try: **postgresql-pgvector-demo.cjs** or **pgvector-web-interface.html**

### "I'm debugging why content doesn't appear in Datadog"
→ Use: **datadog-llmobs-io-capture-test.py** (tests I/O capture explicitly)

### "I need to set up PostgreSQL + GenAI quickly"
→ Run: **postgresql-genai-setup.sh** (automated setup)

---

## 💰 Cost Summary

| Demo | Cost per Run | API Calls |
|------|--------------|-----------|
| datadog-llmobs-agentless-proof.py | FREE | None |
| datadog-ddtrace-basic-test.py | FREE | None |
| crewai-vm-management-demo.py | FREE | None |
| postgresql-* demos | FREE | None |
| datadog-llmobs-io-capture-test.py | ~$0.01 | 1 OpenAI call |
| crewai-4-agent-openai-workflow.py | ~$0.10-0.50 | Multiple OpenAI calls |

---

## 📖 Documentation

**Datadog Integration:**
- [Datadog LLM Observability Setup](../docs/src/content/docs/datadog-llm-observability.md)
- [Datadog Configuration](DATADOG_SETUP.md)
- [Verified Working Status](VERIFIED_WORKING.md)

**CrewAI:**
- [Datadog CrewAI Integration](https://docs.datadoghq.com/integrations/crewai/)
- [CrewAI Documentation](https://docs.crewai.com/)

**PostgreSQL + pgvector:**
- [PostgreSQL GenAI Demo Guide](../docs/src/content/docs/postgresql-genai-demo-guide.md)
- [Prisma + pgvector Setup](../docs/src/content/docs/prisma-pgvector.md)

---

## 🔍 Troubleshooting

### Datadog traces not appearing

1. **Check API key is set:**
   ```bash
   echo $DD_API_KEY | head -c 10
   ```

2. **Run agentless proof test:**
   ```bash
   python demos/datadog-llmobs-agentless-proof.py
   ```

3. **Enable debug logging:**
   ```bash
   DD_TRACE_DEBUG=1 python your-demo.py
   ```

### CrewAI import errors

```bash
pip install crewai langchain-openai ddtrace
```

### PostgreSQL connection errors

1. **Check PostgreSQL is running:**
   ```bash
   docker ps | grep postgres
   ```

2. **Verify connection settings:**
   ```bash
   psql -h localhost -p 5432 -U postgres -d workspace_rag
   ```

---

## 📝 Additional Files

- **requirements.txt** - Python dependencies for all demos
- **Dockerfile** - Container image for running demos
- **DATADOG_SETUP.md** - Detailed Datadog setup instructions
- **VERIFIED_WORKING.md** - Proof of working integrations
- **INPUT_OUTPUT_CAPTURE.md** - Notes on I/O capture implementation

---

## 🤝 Contributing

To add a new demo:

1. Choose descriptive filename: `<category>-<purpose>-<type>.ext`
2. Add comprehensive docstring with PURPOSE, WHAT IT DEMONSTRATES, WHEN TO USE, COST, REQUIREMENTS, USAGE
3. Update this README.md with new demo entry
4. Add to appropriate category
5. Test and verify demo works

---

## 📄 License

MIT - Same as VibeCode platform

---

**Last Updated:** November 19, 2025
**Status:** All demos verified and documented
