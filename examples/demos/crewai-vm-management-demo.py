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
CrewAI VM Management Demo with Datadog Monitoring

PURPOSE:
    Educational demo showing CrewAI agent orchestration patterns without
    making real LLM API calls. Uses CrewAI's built-in agent logic to
    demonstrate workflow patterns while being traced by Datadog.

WHAT IT DEMONSTRATES:
    - CrewAI multi-agent orchestration framework
    - Agent role and task definition patterns
    - Sequential workflow process (Research → Implementation → QA)
    - Automatic Datadog LLM Observability integration
    - Real-time monitoring of agent workflows
    - No-cost testing of agent patterns

AGENTS:
    1. VZ Research Engineer - Studies bootloader patterns
    2. Bootloader Engineer - Creates EFI configuration
    3. Service Installation Engineer - Configures cloud-init
    4. QA Validation Engineer - Tests and validates

WHEN TO USE:
    - Learning CrewAI agent patterns without API costs
    - Testing Datadog integration setup
    - Prototyping multi-agent workflows
    - Demonstrating agent orchestration concepts

COST:
    FREE - No LLM API calls, uses CrewAI's built-in logic only

REQUIREMENTS:
    pip install crewai ddtrace
    export DD_API_KEY=... (or have Datadog Agent running)

USAGE:
    ddtrace-run python demos/crewai-vm-management-demo.py

VIEW RESULTS:
    https://app.datadoghq.com/llm/traces
    Search: ml_app:vibecode-crewai-demo

BASED ON:
    https://docs.datadoghq.com/integrations/crewai/
"""

import os
import sys

# Configure Datadog before importing CrewAI
# This ensures ddtrace instruments everything
os.environ.setdefault('DD_LLMOBS_ENABLED', '1')
os.environ.setdefault('DD_LLMOBS_ML_APP', 'vibecode-crewai-demo')
os.environ.setdefault('DD_SITE', 'datadoghq.com')

try:
    from crewai import Agent, Task, Crew, Process
except ImportError:
    print("Error: CrewAI not installed")
    print("Install with: pip install -r demos/requirements.txt")
    sys.exit(1)

# Define Agents
research_agent = Agent(
    role='VZ Research Engineer',
    goal='Study Tart and UTM source code to understand bootloader and VirtIO patterns',
    backstory="""Expert in Apple Virtualization framework and Swift.
    Specializes in studying open source VM tools to learn best practices.
    Can read code from Tart (Fair Source) and UTM (Apache 2.0) to understand
    patterns without copying code.""",
    verbose=True,
    allow_delegation=False
)

bootloader_agent = Agent(
    role='Bootloader Engineer',
    goal='Create reproducible EFI bootloader configuration for Alpine Linux VMs',
    backstory="""Expert in UEFI boot, EFI variable stores, and GRUB.
    Understands how to make fresh Linux images bootable on Apple VZ.
    Works with GPT partitions and EFI system partitions.""",
    verbose=True,
    allow_delegation=False
)

service_agent = Agent(
    role='Service Installation Engineer', 
    goal='Install PostgreSQL, Valkey, Node.js, and OpenVSCode in VMs via cloud-init',
    backstory="""Expert in Linux system administration and cloud-init.
    Specializes in Alpine Linux package management and service configuration.
    Knows how to make services start on boot and listen on all interfaces.""",
    verbose=True,
    allow_delegation=False
)

qa_agent = Agent(
    role='QA Validation Engineer',
    goal='Test all VMs boot successfully and all services are accessible',
    backstory="""Expert in automated testing and validation.
    Writes comprehensive test suites and verifies functionality.
    Ensures quality standards are met before release.""",
    verbose=True,
    allow_delegation=False
)

# Define Tasks
research_task = Task(
    description="""Study Tart and UTM source code:
    
    1. Clone repositories:
       - https://github.com/cirruslabs/tart
       - https://github.com/utmapp/UTM
    
    2. Find and analyze:
       - How they configure VZEFIBootLoader for Linux VMs
       - How they initialize EFI variable stores
       - How they handle VirtIO-FS directory mounting
       - How they distribute VM images
    
    3. Document findings:
       - Bootloader initialization patterns
       - VirtIO configuration examples
       - Image distribution strategies
    
    4. Create actionable recommendations for VibeCode
    
    Remember: Can study code, cannot copy. Tart is Fair Source (incompatible).
    """,
    expected_output='Detailed research document with VZ patterns and implementation recommendations',
    agent=research_agent
)

bootloader_task = Task(
    description="""Create reproducible bootloader solution:
    
    Based on research findings, create a solution that:
    
    1. Takes fresh Alpine cloud image
    2. Configures EFI bootloader properly
    3. Creates valid NVRAM with boot entries
    4. Results in bootable VM on VZ
    
    Options to explore:
    - Pre-boot with vfkit to install GRUB
    - Use Packer to build VMs with bootloader
    - Script EFI partition setup
    - Use pre-built base images
    
    Must be reproducible (not manual copying).
    Document in: docs/BOOTLOADER_SOLUTION.md
    """,
    expected_output='Reproducible script or process to create bootable VMs',
    agent=bootloader_agent
)

service_task = Task(
    description="""Install services in VMs using cloud-init:
    
    For each VM, install and configure:
    
    1. PostgreSQL VM:
       - Install postgresql packages
       - Initialize database cluster
       - Configure to listen on 0.0.0.0:5432
       - Create test database
    
    2. Valkey VM:
       - Install redis package
       - Configure to listen on 0.0.0.0:6379
       - Disable protected mode
    
    3. Node.js VM:
       - Install nodejs and npm
       - Create test HTTP server on port 3000
    
    4. OpenVSCode VM:
       - Install code-server
       - Configure on port 8080
       - Set password or disable auth
    
    Use cloud-init configs in config/cloud-init/
    Test that services start and are accessible.
    """,
    expected_output='Working services in all 4 VMs with connectivity validated',
    agent=service_agent
)

qa_task = Task(
    description="""Validate everything works:
    
    1. Run staff-level test suite:
       ./scripts/staff-level-test-suite.sh
    
    2. Verify all 6 VMs boot successfully
    
    3. Test service connectivity:
       - PostgreSQL: psql -h <vm-ip> -p 5432
       - Valkey: redis-cli -h <vm-ip> -p 6379
       - Node.js: curl http://<vm-ip>:3000
       - VSCode: curl http://<vm-ip>:8080
    
    4. Validate Datadog metrics:
       - Check for vibecode.vm.* metrics
       - Verify events appear
       - Validate dashboard
    
    5. Document results:
       - Update VMS_WORKING_STATUS.md
       - Final test report
       - v1.0 readiness assessment
    
    Goal: 100% test coverage, all services working.
    """,
    expected_output='Complete test report with all validations passing',
    agent=qa_agent
)

# Create Crew
crew = Crew(
    agents=[research_agent, bootloader_agent, service_agent, qa_agent],
    tasks=[research_task, bootloader_task, service_task, qa_task],
    process=Process.sequential,  # Research → Bootloader → Services → QA
    verbose=True
)

# Run the crew
if __name__ == '__main__':
    print("=" * 60)
    print("VibeCode Multi-Agent Workflow")
    print("Monitored by Datadog LLM Observability")
    print("=" * 60)
    print()
    
    result = crew.kickoff()
    
    print()
    print("=" * 60)
    print("Workflow Complete")
    print("=" * 60)
    print()
    print("Result:")
    print(result)
    print()
    print("View in Datadog:")
    print("https://app.datadoghq.com/llm/traces")
