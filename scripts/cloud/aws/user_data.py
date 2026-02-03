#!/usr/bin/env python3
"""EC2 user-data script generator for code-server workspace.

This module generates the user-data script that runs on EC2 instance first boot.
It installs Docker and starts a code-server container.

Note: The generated script is a bash script intended to run on Ubuntu EC2 instances,
not a Python script. This module provides the script content as a string.
"""

from __future__ import annotations

import os
import sys
from textwrap import dedent


def get_user_data_script(password: str | None = None) -> str:
    """Generate the user-data bash script for EC2 instances.

    Args:
        password: Password for code-server. Defaults to 'changeme' if not provided.

    Returns:
        Bash script content as a string.
    """
    pwd = password or os.environ.get("PASSWORD", "changeme")

    return dedent(f"""\
        #!/bin/bash
        set -euxo pipefail

        apt-get update
        apt-get install -y docker.io
        systemctl enable --now docker

        mkdir -p /home/ubuntu/workspace
        chown ubuntu:ubuntu /home/ubuntu/workspace

        docker run -d --restart unless-stopped \\
          -e PASSWORD={pwd} \\
          -p 8765:8765 \\
          -v /home/ubuntu/workspace:/home/coder/project \\
          ghcr.io/ryanmaclean/vibecode-codeserver:latest
    """)


def main() -> int:
    """Main entry point - prints the user-data script to stdout."""
    password = os.environ.get("PASSWORD")
    script = get_user_data_script(password)
    print(script)
    return 0


if __name__ == "__main__":
    sys.exit(main())
