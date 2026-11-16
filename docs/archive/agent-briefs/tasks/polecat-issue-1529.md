# Task: Resolve Issue #1529

Title: Feature Audit: Sparse disk** - 1GB disk that grows as needed
Source: GitHub Issue #1529
Status: Completed
Resolution: Implemented in `scripts/launch_ubuntu_vm.py`. Uses `truncate -s 20G` which creates a sparse file on APFS/ext4, consuming minimal space initially.
