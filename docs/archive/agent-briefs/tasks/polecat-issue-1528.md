# Task: Resolve Issue #1528

Title: Feature Audit: Multiple instances** - Run several VMs simultaneously
Source: GitHub Issue #1528
Status: Completed
Resolution: Implemented in `scripts/launch_ubuntu_vm.py` via `--name` argument. VM data is isolated in `~/VibeCode/VMs/{name}`. CLI updated to forward arguments.
