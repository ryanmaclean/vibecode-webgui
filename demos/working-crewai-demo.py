#!/usr/bin/env python3
"""
Working CrewAI Demo with Real OpenAI Calls and Datadog Monitoring

Demonstrates actual AI agents solving VM management tasks with different models.
All traced in Datadog LLM Observability.
"""

import os
import sys

# Datadog configuration - BEFORE imports
os.environ['DD_LLMOBS_ENABLED'] = '1'
os.environ['DD_LLMOBS_AGENTLESS_ENABLED'] = '1'
os.environ['DD_LLMOBS_ML_APP'] = 'vibecode-crewai-working'
os.environ['DD_SERVICE'] = 'vibecode-crew'
os.environ['DD_ENV'] = 'demo'

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
except ImportError as e:
    print(f"Missing dependency: {e}")
    print("Install: pip install crewai langchain-openai")
    sys.exit(1)

# Different OpenAI models for different agents
gpt4 = ChatOpenAI(model="gpt-4-turbo-preview", temperature=0.7)
gpt35 = ChatOpenAI(model="gpt-3.5-turbo", temperature=0.5)
gpt4o = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)

# Agent 1: Research with GPT-4 (most capable)
research_agent = Agent(
    role='Senior VZ Research Engineer',
    goal='Analyze bootloader issues and propose solutions based on Tart/UTM patterns',
    backstory="""You are an expert in Apple Virtualization framework and UEFI boot.
    You've studied Tart and UTM source code extensively.
    You understand EFI variable stores, boot entries, and GRUB configuration.
    You provide detailed technical analysis with code examples.""",
    llm=gpt4,
    verbose=True,
    allow_delegation=False
)

# Agent 2: Implementation with GPT-3.5 (fast, practical)
bootloader_agent = Agent(
    role='Bootloader Implementation Engineer',
    goal='Create practical, working solution for EFI bootloader configuration',
    backstory="""You are a pragmatic engineer who gets things done.
    You take research findings and turn them into working scripts.
    You write clean, tested code that solves real problems.
    You focus on reproducibility and automation.""",
    llm=gpt35,
    verbose=True,
    allow_delegation=False
)

# Agent 3: Service expert with GPT-4o (balanced)
service_agent = Agent(
    role='Linux Service Installation Expert',
    goal='Configure PostgreSQL, Valkey, and Node.js services via cloud-init',
    backstory="""You are an expert in Alpine Linux and cloud-init.
    You know how to install packages, configure services, and make them start on boot.
    You write robust cloud-init configurations that work reliably.
    You test thoroughly and document your work.""",
    llm=gpt4o,
    verbose=True,
    allow_delegation=False
)

# Agent 4: QA with GPT-3.5 (efficient testing)
qa_agent = Agent(
    role='QA Validation Engineer',
    goal='Verify all VMs boot and all services are accessible',
    backstory="""You are a thorough QA engineer who leaves nothing untested.
    You write comprehensive test plans and validate every requirement.
    You find edge cases and potential failures.
    You ensure quality before declaring success.""",
    llm=gpt35,
    verbose=True,
    allow_delegation=False
)

# Define actual tasks with real prompts
research_task = Task(
    description="""Analyze the VibeCode VM bootloader problem:

Context:
- We have 6 Alpine Linux VMs for macOS using Apple Virtualization.framework
- 2 VMs (ide, pgvector) boot successfully
- 4 VMs (postgresql, valkey, nodejs, codeserver) show "invalid bootloader" error
- Fresh Alpine cloud images don't have GRUB pre-installed
- EFI NVRAM files are either empty or have wrong boot entries

Research Questions:
1. How do Tart and UTM handle fresh Linux image boot on VZ?
2. What's the correct EFI initialization sequence?
3. Should we use cloud-init ISO, pre-boot with vfkit, or Packer?
4. What's the most reproducible solution?

Provide:
- Technical analysis of the bootloader issue
- Comparison of solution approaches
- Recommended implementation path
- Code patterns from Tart/UTM (reference only, don't copy)
""",
    expected_output="""Detailed technical analysis with:
    1. Root cause of bootloader issue
    2. How Tart/UTM solve it
    3. Recommended solution for VibeCode
    4. Implementation approach with example patterns""",
    agent=research_agent
)

bootloader_task = Task(
    description="""Based on research findings, create a working bootloader solution:

Requirements:
- Must work with fresh Alpine cloud images
- Must be reproducible (not manual copying)
- Must create valid EFI boot entries
- Must result in all 6 VMs booting

Implementation Options:
1. Script to initialize EFI partition and install GRUB
2. Packer template to build bootable VMs
3. Cloud-init with bootloader setup
4. Pre-boot process using existing tools

Output:
- Working script or process
- Documentation of steps
- Test validation approach
""",
    expected_output="""Complete implementation including:
    1. Script or process to create bootable VMs
    2. Step-by-step documentation
    3. How to validate it works
    4. Any prerequisites or dependencies""",
    agent=bootloader_agent
)

service_task = Task(
    description="""Create cloud-init configurations for service installation:

For each VM:
1. PostgreSQL: Install postgresql, create database, configure for 0.0.0.0:5432
2. Valkey: Install redis, configure for 0.0.0.0:6379
3. Node.js: Install nodejs+npm, create test server on port 3000
4. OpenVSCode: Install code-server, configure on port 8080

Requirements:
- Use cloud-init YAML format
- Services must auto-start on boot
- Services must be accessible from host
- Include health check endpoints

Reference existing configs in: config/cloud-init/
""",
    expected_output="""Complete cloud-init configs with:
    1. Package installation
    2. Service configuration  
    3. Auto-start setup
    4. Validation commands""",
    agent=service_agent
)

qa_task = Task(
    description="""Create comprehensive test plan for VM validation:

Test Coverage:
1. All 6 VMs boot without errors
2. Each VM gets network IP (192.168.64.x)
3. PostgreSQL accessible and can create database
4. Valkey accessible and can SET/GET
5. Node.js accessible and HTTP server responds
6. OpenVSCode accessible and web UI loads

Create:
- Automated test script
- Manual test checklist
- Success criteria
- What to check if tests fail
""",
    expected_output="""Complete test plan with:
    1. Automated test commands
    2. Expected results for each test
    3. How to verify in Datadog
    4. Final validation checklist""",
    agent=qa_agent
)

# Create crew with sequential process
crew = Crew(
    agents=[research_agent, bootloader_agent, service_agent, qa_agent],
    tasks=[research_task, bootloader_task, service_task, qa_task],
    process=Process.sequential,
    verbose=True
)

if __name__ == '__main__':
    print("=" * 80)
    print("VibeCode Multi-Agent Workflow - Real AI Execution")
    print("4 Agents, 3 Different Models, Monitored in Datadog")
    print("=" * 80)
    print()
    print("Agents:")
    print("  1. Research (GPT-4): Analyze bootloader problem")
    print("  2. Bootloader (GPT-3.5): Create implementation") 
    print("  3. Services (GPT-4o-mini): Configure cloud-init")
    print("  4. QA (GPT-3.5): Validate everything")
    print()
    print("All execution traced in Datadog LLM Observability")
    print("=" * 80)
    print()
    
    try:
        result = crew.kickoff()
        
        print()
        print("=" * 80)
        print("Workflow Complete")
        print("=" * 80)
        print()
        print("Final Output:")
        print(result)
        print()
        print("View full trace in Datadog:")
        print("https://app.datadoghq.com/llm/traces")
        print()
        print("Search: ml_app:vibecode-crewai-working")
        
    except Exception as e:
        print(f"Error: {e}")
        print()
        print("Check that OPENAI_API_KEY is set")
        sys.exit(1)

