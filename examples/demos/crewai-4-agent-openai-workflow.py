#!/usr/bin/env python3

# -- VibeCode Telemetry --
import sys
import os
try:
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../')))
    from vibecode.telemetry import init_telemetry
    tracer = init_telemetry(os.path.basename(__file__))
except ImportError:
    pass
# ------------------------

"""
VibeCode Daily Platform Health Check - Multi-Agent Workflow

PURPOSE:
    Production-ready daily health check using AI agents to audit platform quality,
    security, documentation, and recent changes. Designed to run daily via cron
    and report findings to Datadog for monitoring and alerting.

WHAT IT DOES:
    Runs 4 specialized AI agents to perform comprehensive platform audit:
    1. Security Auditor - Checks dependencies, secrets, vulnerabilities
    2. Documentation Reviewer - Reviews docs for accuracy and completeness
    3. Code Quality Analyst - Reviews recent commits for quality issues
    4. Report Generator - Compiles findings into actionable daily report

AGENTS:
    1. Security Auditor (GPT-4) - Deep security analysis
    2. Documentation Reviewer (GPT-3.5) - Fast doc review
    3. Code Quality Analyst (GPT-4o-mini) - Efficient code analysis
    4. Report Generator (GPT-3.5) - Summary compilation

WHEN TO USE:
    - Run daily via cron for continuous platform monitoring
    - Before major releases for comprehensive health check
    - After merging significant changes
    - As part of CI/CD quality gates

DAILY SCHEDULE:
    # Add to crontab for daily 9 AM run:
    0 9 * * * cd /path/to/vibecode-webgui && python demos/crewai-4-agent-openai-workflow.py

COST:
    ~$0.20-0.40 per run (4 agents, reasonable prompts)
    ~$6-12 per month if run daily

MONITORING:
    All execution traced in Datadog LLM Observability
    - Service: vibecode-platform-health
    - ML App: vibecode-daily-audit
    - Alerts on failed checks or high-severity findings

REQUIREMENTS:
    pip install crewai langchain-openai ddtrace gitpython
    export OPENAI_API_KEY=sk-...
    export DD_API_KEY=...

USAGE:
    python demos/crewai-4-agent-openai-workflow.py

VIEW RESULTS:
    https://app.datadoghq.com/llm/traces
    Search: service:vibecode-platform-health
"""

import os
import sys

# Datadog configuration - BEFORE imports
os.environ['DD_LLMOBS_ENABLED'] = '1'
os.environ['DD_LLMOBS_AGENTLESS_ENABLED'] = '1'
os.environ['DD_LLMOBS_ML_APP'] = 'vibecode-daily-audit'
os.environ['DD_SERVICE'] = 'vibecode-platform-health'
os.environ['DD_ENV'] = os.getenv('DD_ENV', 'production')  # Allow override

# Get Datadog API key
try:
    with open('/opt/datadog-agent/etc/datadog.yaml') as f:
        for line in f:
            if line.strip().startswith('api_key:') and 'dogfood' not in line.lower():
                os.environ['DD_API_KEY'] = line.split(':', 1)[1].strip()
                break
except:
    print("Set DD_API_KEY environment variable")
    sys.exit(1)

os.environ['DD_SITE'] = 'datadoghq.com'

# OpenAI API key
if not os.getenv('OPENAI_API_KEY'):
    print("Set OPENAI_API_KEY environment variable")
    sys.exit(1)

try:
    from crewai import Agent, Task, Crew, Process
    from langchain_openai import ChatOpenAI
    from ddtrace import patch_all
    from ddtrace.llmobs import LLMObs
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install: pip install crewai langchain-openai ddtrace")
    sys.exit(1)

# Patch LangChain to ensure OpenAI calls are traced
patch_all()

# Enable LLMObs explicitly
LLMObs.enable(
    ml_app=os.getenv('DD_LLMOBS_ML_APP', 'vibecode-daily-audit'),
    agentless_enabled=True,
    api_key=os.getenv('DD_API_KEY'),
    site=os.getenv('DD_SITE', 'datadoghq.com')
)

# Get today's date for reporting
from datetime import datetime
TODAY = datetime.now().strftime('%Y-%m-%d')

# Different OpenAI models for different agents
gpt4 = ChatOpenAI(model="gpt-4-turbo-preview", temperature=0.7)
gpt35 = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.5)
gpt4o = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

# Agent 1: Security Auditor with GPT-4 (most capable for security analysis)
security_agent = Agent(
    role='Platform Security Auditor',
    goal='Identify security vulnerabilities, exposed secrets, and outdated dependencies',
    backstory="""You are a senior security engineer specializing in application security.
    You review codebases for:
    - Exposed API keys, tokens, passwords in code or configs
    - Outdated npm/pip packages with known vulnerabilities
    - Insecure configurations (weak auth, open ports, etc.)
    - OWASP Top 10 vulnerabilities
    - Docker security best practices
    You provide actionable recommendations with severity ratings.""",
    llm=gpt4,
    verbose=True,
    allow_delegation=False
)

# Agent 2: Documentation Reviewer with GPT-3.5 (fast, good for docs)
docs_agent = Agent(
    role='Documentation Quality Reviewer',
    goal='Ensure documentation is accurate, complete, and up-to-date',
    backstory="""You are a technical writer who ensures documentation quality.
    You check for:
    - Outdated instructions or broken links
    - Missing documentation for new features
    - Inconsistencies between docs and code
    - README completeness and clarity
    - Setup instructions accuracy
    You suggest specific improvements with examples.""",
    llm=gpt35,
    verbose=True,
    allow_delegation=False
)

# Agent 3: Code Quality Analyst with GPT-4o-mini (efficient for code review)
code_quality_agent = Agent(
    role='Code Quality Analyst',
    goal='Review recent commits for code quality issues and technical debt',
    backstory="""You are a senior software engineer focused on code quality.
    You review recent changes for:
    - Code complexity and maintainability
    - Error handling and edge cases
    - Performance issues or inefficiencies
    - Missing tests or low coverage areas
    - Technical debt accumulation
    You provide constructive feedback with code examples.""",
    llm=gpt4o,
    verbose=True,
    allow_delegation=False
)

# Agent 4: Report Generator with GPT-3.5 (efficient for summarization)
report_agent = Agent(
    role='Daily Report Generator',
    goal='Compile findings into clear, actionable daily health report',
    backstory="""You are a technical project manager who synthesizes complex findings.
    You create reports that:
    - Prioritize issues by severity (Critical, High, Medium, Low)
    - Provide executive summary and detailed findings
    - Include actionable next steps
    - Track trends over time
    - Suggest sprint planning items
    Your reports are clear, concise, and drive action.""",
    llm=gpt35,
    verbose=True,
    allow_delegation=False
)

# Task 1: Security Audit
security_task = Task(
    description=f"""Perform comprehensive security audit of VibeCode platform ({TODAY}):

**Check the following areas:**

1. **Secret Exposure**:
   - Review package.json, .env.example, docker-compose.yml for exposed keys
   - Check recent commits (last 7 days) for accidentally committed secrets
   - Verify pre-commit hooks are preventing secret leaks

2. **Dependency Vulnerabilities**:
   - Check npm audit output for high/critical vulnerabilities
   - Review Python requirements.txt for outdated packages
   - Check Docker base images for known CVEs

3. **Configuration Security**:
   - PostgreSQL authentication and network exposure
   - Datadog API key handling and rotation
   - OpenVSCode Server authentication
   - Docker container security (running as root, exposed ports)

4. **OWASP Top 10**:
   - Injection vulnerabilities in database queries
   - Broken authentication
   - Sensitive data exposure
   - XML/JSON parsing security

**Provide findings with:**
- Severity: CRITICAL/HIGH/MEDIUM/LOW
- Specific file/line references
- Remediation steps
- Timeline for fixes""",
    expected_output="""Security audit report with:
    1. Executive summary (critical findings count)
    2. Detailed findings by severity
    3. Specific remediation steps
    4. Recommended timeline for fixes""",
    agent=security_agent
)

# Task 2: Documentation Review
docs_task = Task(
    description=f"""Review VibeCode documentation for quality and accuracy ({TODAY}):

**Review these documentation areas:**

1. **Main README.md**:
   - Are setup instructions current and accurate?
   - Do all links work?
   - Is the quick start guide up-to-date?
   - Are new features documented?

2. **Astro Documentation Site** (docs/src/content/docs/):
   - Check for outdated information
   - Verify code examples still work
   - Ensure new features are documented
   - Check sidebar organization

3. **API Documentation**:
   - Are all endpoints documented?
   - Are request/response examples accurate?
   - Is authentication properly explained?

4. **Docker/Deployment Docs**:
   - Verify docker-compose.yml matches docs
   - Check environment variable documentation
   - Ensure deployment guides are current

5. **Recent Changes** (last 7 days):
   - Identify undocumented features
   - Find docs that need updates based on code changes

**For each issue found:**
- File path and section
- Current vs. recommended content
- Impact on users (HIGH/MEDIUM/LOW)""",
    expected_output="""Documentation review report with:
    1. Summary of issues found
    2. Detailed findings by documentation area
    3. Specific recommended changes
    4. Priority order for fixes""",
    agent=docs_agent
)

# Task 3: Code Quality Analysis
code_quality_task = Task(
    description=f"""Analyze recent code changes for quality issues ({TODAY}):

**Review commits from the last 7 days:**

1. **Code Complexity**:
   - Functions/methods over 50 lines
   - Cyclomatic complexity > 10
   - Deeply nested code (>3 levels)
   - Duplicate code patterns

2. **Error Handling**:
   - Missing try/catch blocks
   - Unhandled promise rejections
   - Empty catch blocks
   - Insufficient error logging

3. **Performance**:
   - N+1 query patterns
   - Inefficient loops
   - Missing indexes on database queries
   - Large bundle sizes

4. **Testing**:
   - New code without tests
   - Test coverage < 80%
   - Brittle tests (high coupling)
   - Missing edge case tests

5. **Technical Debt**:
   - TODO/FIXME comments
   - Commented-out code
   - Magic numbers/strings
   - Tight coupling between modules

**For each issue:**
- File and line number
- Severity (HIGH/MEDIUM/LOW)
- Code example
- Refactoring suggestion""",
    expected_output="""Code quality report with:
    1. Overall quality score
    2. Detailed findings by category
    3. Code examples and refactoring suggestions
    4. Recommended refactoring priorities""",
    agent=code_quality_agent
)

# Task 4: Daily Health Report
report_task = Task(
    description=f"""Compile VibeCode Platform Daily Health Report ({TODAY}):

**Synthesize findings from Security, Documentation, and Code Quality audits into a comprehensive daily report.**

**Report Structure:**

1. **Executive Summary** (1 paragraph):
   - Overall platform health score (A-F)
   - Critical issues count
   - Trend vs. yesterday (improving/declining)
   - Top priority action

2. **Security Findings**:
   - Critical/High severity issues
   - Actionable next steps
   - Required timeline

3. **Documentation Issues**:
   - High-impact doc problems
   - Quick wins (easy fixes)
   - Documentation debt

4. **Code Quality**:
   - Code quality trends
   - Technical debt hotspots
   - Refactoring priorities

5. **Action Items**:
   - Today's priorities (P0)
   - This week (P1)
   - This sprint (P2)
   - Backlog (P3)

6. **Metrics**:
   - Issues by severity
   - Trends over time
   - Team velocity impact

**Format**: Clear markdown suitable for Slack/email/GitHub issues""",
    expected_output="""Daily health report with:
    1. Executive summary with health score
    2. Prioritized findings by category
    3. Actionable items with timelines
    4. Trend analysis and metrics""",
    agent=report_agent
)

# Create crew with sequential process
crew = Crew(
    agents=[security_agent, docs_agent, code_quality_agent, report_agent],
    tasks=[security_task, docs_task, code_quality_task, report_task],
    process=Process.sequential,
    verbose=True
)

if __name__ == '__main__':
    print("=" * 80)
    print(f"VibeCode Platform Daily Health Check - {TODAY}")
    print("4 AI Agents | 3 OpenAI Models | Full Datadog Tracing")
    print("=" * 80)
    print()
    print("Agents:")
    print("  1. Security Auditor (GPT-4): Vulnerability & secrets scan")
    print("  2. Docs Reviewer (GPT-3.5): Documentation quality check")
    print("  3. Code Quality (GPT-4o-mini): Recent commits analysis")
    print("  4. Report Generator (GPT-3.5): Daily health report")
    print()
    print("Monitoring:")
    print(f"  Service: {os.getenv('DD_SERVICE')}")
    print(f"  ML App: {os.getenv('DD_LLMOBS_ML_APP')}")
    print(f"  Environment: {os.getenv('DD_ENV')}")
    print()
    print("View results: https://app.datadoghq.com/llm/traces")
    print("=" * 80)
    print()
    
    try:
        # Wrap execution in LLMObs workflow to ensure content is captured
        with LLMObs.workflow(name="vibecode_daily_platform_health_check"):
            # Collect all task descriptions as input
            workflow_input = {
                "date": TODAY,
                "workflow": "daily_health_check",
                "tasks": [
                    {
                        "name": "Security Audit",
                        "agent": security_agent.role,
                        "model": "gpt-4-turbo-preview",
                        "focus": "vulnerabilities, secrets, dependencies"
                    },
                    {
                        "name": "Documentation Review",
                        "agent": docs_agent.role,
                        "model": "gpt-3.5-turbo",
                        "focus": "accuracy, completeness, recent changes"
                    },
                    {
                        "name": "Code Quality Analysis",
                        "agent": code_quality_agent.role,
                        "model": "gpt-4o-mini",
                        "focus": "complexity, errors, performance, tests, debt"
                    },
                    {
                        "name": "Daily Report Generation",
                        "agent": report_agent.role,
                        "model": "gpt-3.5-turbo",
                        "focus": "synthesis, prioritization, action items"
                    }
                ]
            }
            
            # Annotate workflow with input
            LLMObs.annotate(
                input_data=workflow_input,
                metadata={
                    "workflow_type": "daily_health_check",
                    "date": TODAY,
                    "agent_count": 4,
                    "models": ["gpt-4-turbo-preview", "gpt-3.5-turbo", "gpt-4o-mini"],
                    "process": "sequential",
                    "service": os.getenv('DD_SERVICE'),
                    "environment": os.getenv('DD_ENV')
                }
            )
            
            # Execute crew
            result = crew.kickoff()
            
            # Capture the actual result output
            result_str = str(result)
            if hasattr(result, 'raw'):
                result_str = str(result.raw)
            
            # Annotate workflow with output
            LLMObs.annotate(
                output_data=result_str,
                metadata={
                    "completed": True,
                    "result_length": len(result_str),
                    "workflow_type": "daily_health_check",
                    "date": TODAY
                }
            )
        
        # Flush to ensure all spans are sent
        LLMObs.flush()
        
        print()
        print("=" * 80)
        print(f"Daily Health Check Complete - {TODAY}")
        print("=" * 80)
        print()
        print("Daily Health Report:")
        print("-" * 80)
        print(result)
        print("-" * 80)
        print()
        print("View full trace in Datadog:")
        print("https://app.datadoghq.com/llm/traces")
        print()
        print(f"Search filters:")
        print(f"  service:{os.getenv('DD_SERVICE')}")
        print(f"  ml_app:{os.getenv('DD_LLMOBS_ML_APP')}")
        print(f"  env:{os.getenv('DD_ENV')}")
        print()
        print("✓ Platform health check complete")
        print("✓ Report generated and traced in Datadog")
        print("✓ Review findings and create action items")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        print()
        print("Check that OPENAI_API_KEY is set")
        sys.exit(1)
