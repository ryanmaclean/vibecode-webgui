"""
Gas Town Custom Datadog Check
Monitors Gas Town agents, polecats, and workspace health.

Install:
  sudo cp gastown.py /opt/datadog-agent/checks.d/
  sudo launchctl stop com.datadoghq.agent && sudo launchctl start com.datadoghq.agent
"""

import subprocess
import os

try:
    from datadog_checks.base import AgentCheck
except ImportError:
    # For testing outside Datadog agent
    class AgentCheck:
        OK = 0
        WARNING = 1
        CRITICAL = 2
        def __init__(self, *args, **kwargs): pass
        def gauge(self, *args, **kwargs): print(f"GAUGE: {args}")
        def service_check(self, *args, **kwargs): print(f"SERVICE_CHECK: {args}")
        class log:
            @staticmethod
            def warning(msg): print(f"WARNING: {msg}")


class GasTownCheck(AgentCheck):
    """Custom check for Gas Town multi-agent workspace manager."""

    def check(self, instance):
        gt_root = instance.get('gt_root', os.environ.get('GT_ROOT', '/Users/studio/gt'))
        tags = instance.get('tags', [])

        # Check Gas Town availability and get status
        try:
            result = subprocess.run(
                ['gt', 'status', '--fast'],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=gt_root,
                env={**os.environ, 'PATH': f"/opt/homebrew/bin:/usr/local/bin:{os.environ.get('PATH', '')}"}
            )
            if result.returncode == 0:
                self.service_check('gastown.available', AgentCheck.OK, tags=tags)
                self._parse_status(result.stdout, tags)
            else:
                self.service_check('gastown.available', AgentCheck.WARNING, tags=tags,
                                   message=f'gt status failed: {result.stderr[:200]}')
        except subprocess.TimeoutExpired:
            self.service_check('gastown.available', AgentCheck.WARNING, tags=tags,
                               message='gt status timed out')
        except FileNotFoundError:
            self.service_check('gastown.available', AgentCheck.CRITICAL, tags=tags,
                               message='gt command not found')
        except Exception as e:
            self.service_check('gastown.available', AgentCheck.CRITICAL, tags=tags,
                               message=f'Error: {str(e)[:200]}')

        # Get ready work count
        try:
            result = subprocess.run(
                ['gt', 'ready'],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=gt_root,
                env={**os.environ, 'PATH': f"/opt/homebrew/bin:/usr/local/bin:{os.environ.get('PATH', '')}"}
            )
            if result.returncode == 0:
                # Parse "Total: X items ready"
                for line in result.stdout.split('\n'):
                    if 'Total:' in line:
                        parts = line.split()
                        for i, p in enumerate(parts):
                            if p.isdigit():
                                self.gauge('gastown.work.ready', int(p), tags=tags)
                                break
        except Exception as e:
            self.log.warning(f'Failed to get ready work: {e}')

    def _parse_status(self, output, tags):
        """Parse gt status output for metrics."""
        lines = output.strip().split('\n')

        active_agents = 0
        total_polecats = 0
        active_polecats = 0

        in_polecats_section = False

        for line in lines:
            # Check for agent status (mayor, deacon, witness, refinery)
            if 'mayor' in line.lower() and 'polecat' not in line.lower():
                active = 1 if '●' in line else 0
                self.gauge('gastown.agent.mayor', active, tags=tags)
                active_agents += active
            elif 'deacon' in line.lower():
                active = 1 if '●' in line else 0
                self.gauge('gastown.agent.deacon', active, tags=tags)
                active_agents += active
            elif 'witness' in line.lower() and 'polecat' not in line.lower():
                active = 1 if '●' in line else 0
                self.gauge('gastown.agent.witness', active, tags=tags)
                active_agents += active
            elif 'refinery' in line.lower():
                active = 1 if '●' in line else 0
                self.gauge('gastown.agent.refinery', active, tags=tags)
                active_agents += active

            # Track polecats section
            if 'Polecats' in line:
                in_polecats_section = True
                # Extract count from "Polecats (N)"
                if '(' in line and ')' in line:
                    try:
                        count = int(line.split('(')[1].split(')')[0])
                        total_polecats = count
                    except:
                        pass
            elif in_polecats_section:
                if line.strip() and not line.startswith('─'):
                    if '●' in line:
                        active_polecats += 1
                elif line.startswith('─') or 'Crew' in line:
                    in_polecats_section = False

        self.gauge('gastown.agents.active', active_agents, tags=tags)
        self.gauge('gastown.polecats.total', total_polecats, tags=tags)
        self.gauge('gastown.polecats.active', active_polecats, tags=tags)


# For standalone testing
if __name__ == '__main__':
    check = GasTownCheck()
    check.check({'gt_root': '/Users/studio/gt', 'tags': ['env:test']})
