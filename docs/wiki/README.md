# VibeCode Wiki

Comprehensive documentation wiki for VibeCode development.

## 🚀 Quick Start

**New to VibeCode Development?**
1. Read the [Architecture Overview](../ARCHITECTURE.md)
2. Browse [Session Summaries](sessions/) to understand recent work
3. Check [Development Guides](guides/) for workflows
4. Review [Proposals](proposals/) for strategic direction

**Looking for Something Specific?**
- **API Documentation** → [api/](api/)
- **Architecture Decisions** → [architecture/](architecture/)
- **How-to Guides** → [guides/](guides/)
- **Session History** → [sessions/](sessions/)
- **Future Plans** → [proposals/](proposals/)

---

## 📚 Wiki Structure

```
docs/wiki/
├── Home.md                    ← Start here
├── README.md                  ← This file
│
├── sessions/                  ← Development session records
│   ├── index.md
│   ├── 2025-10-02-10-persona-coordination.md
│   ├── 2025-10-01-ultra-session.md
│   └── 2025-10-01-handoff.md
│
├── guides/                    ← How-to guides & best practices
│   ├── index.md
│   ├── multi-agent-coordination.md (⭐ Production-ready)
│   ├── docker-optimization.md
│   ├── branch-protection.md
│   └── typescript-baseline.md
│
├── architecture/              ← System design & tech decisions
│   ├── index.md
│   ├── tauri-integration.md
│   ├── mdns-discovery.md
│   └── crdt-collaboration.md
│
├── api/                       ← API documentation
│   ├── index.md
│   └── monitoring-endpoints.md
│
└── proposals/                 ← Enhancement proposals & strategy
    ├── index.md
    ├── roundtable-mcp-subagents.md (⭐ Active proposal)
    ├── console-ai-tools-landscape.md
    └── mcp-ecosystem-analysis.md
```

---

## 🎯 Featured Content

### [Multi-Agent Coordination Methodology](guides/multi-agent-coordination.md) ⭐
**Production-ready methodology** for coordinating 5-10+ AI agents in parallel.
- **Success Rate:** 100% (validated across multiple sessions)
- **Time Savings:** 5-10x vs sequential execution
- **Proven Results:** 15,000+ lines of documentation in one session

### [Roundtable-AI MCP Enhancement Proposal](proposals/roundtable-mcp-subagents.md) ⭐
**Active proposal** to add multi-agent orchestration to roundtable-ai MCP server.
- **Impact:** 5-10x productivity improvement
- **Compatibility:** 100% backward compatible
- **Timeline:** 6-8 weeks (3 phases)

### [10-Persona Coordination Session](sessions/2025-10-02-10-persona-coordination.md) ⭐
**Case study** of successful multi-agent coordination.
- **9/9 agents completed successfully**
- **Zero conflicts detected**
- **9 GitHub issues resolved**

---

## 📖 Documentation Standards

### Writing Style

- **Be Factual** - Document reality, not aspirations
- **Include Examples** - Show, don't just tell
- **Provide Context** - Explain why, not just what
- **Cross-Reference** - Link related documents
- **Keep Updated** - Mark outdated content clearly

### File Organization

- **Use descriptive names** - `multi-agent-coordination.md`, not `guide1.md`
- **Add to index pages** - Every doc should be discoverable
- **Include metadata** - Status, date, author at top
- **Version control** - Track changes in git

### Markdown Conventions

```markdown
# Page Title (H1 - once per page)

## Major Section (H2)

### Subsection (H3)

**Bold for emphasis**
*Italic for terms*
`code or commands`

[Link text](relative-path.md)
```

---

## 🤝 Contributing

### Adding Documentation

1. **Create file** in appropriate section (sessions/, guides/, etc.)
2. **Follow template** from existing docs in that section
3. **Update index** - Add entry to relevant index.md
4. **Cross-link** - Link from Home.md if widely applicable
5. **Commit with message** - `docs(wiki): add [description]`

### Maintaining Documentation

- **Mark outdated content** - Add `**Status:** Outdated` at top
- **Archive old sessions** - Move to `sessions/archive/YYYY/`
- **Update indexes** - Keep navigation current
- **Fix broken links** - Check links when restructuring

---

## 📊 Wiki Statistics

**Last Updated:** 2025-10-02

- **Total Pages:** 20+
- **Session Records:** 3 major sessions documented
- **Active Guides:** 5 production-ready guides
- **Active Proposals:** 1 (Roundtable-AI MCP)
- **Strategic Analyses:** 3 comprehensive analyses

---

## 🔍 Search Tips

### Finding Information

- **By Topic:** Start with index pages (sessions/, guides/, etc.)
- **By Date:** Check session summaries chronologically
- **By Feature:** Look in architecture/ for technical decisions
- **By Workflow:** Browse guides/ for how-to documentation

### Common Searches

- "How to coordinate multiple agents" → [Multi-Agent Coordination](guides/multi-agent-coordination.md)
- "Recent development work" → [Sessions](sessions/)
- "Future plans" → [Proposals](proposals/)
- "Architecture decisions" → [Architecture](architecture/)
- "API documentation" → [API](api/)

---

## 📞 Support

- **GitHub Issues:** Bug reports and feature requests
- **GitHub Discussions:** Questions and community discussion
- **Wiki Updates:** Submit PRs to improve documentation

---

## 🗂️ Related Documentation

### Core Documentation
- [Main README](../../README.md) - Project overview
- [Architecture](../ARCHITECTURE.md) - System architecture
- [Testing Guide](../testing/) - Test infrastructure

### Development
- [API Documentation](../api/) - API endpoints and schemas
- [Deployment](../deployment/) - Deployment guides
- [Security](../SECURITY.md) - Security guidelines

### Community
- [Contributing Guidelines](../../CONTRIBUTING.md)
- [Code of Conduct](../../CODE_OF_CONDUCT.md)

---

**Navigate:** [Home](Home.md) | [Sessions](sessions/) | [Guides](guides/) | [Architecture](architecture/) | [API](api/) | [Proposals](proposals/)

**Maintained by:** VibeCode Development Team
**Last Updated:** 2025-10-02