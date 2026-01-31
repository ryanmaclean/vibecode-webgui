#!/usr/bin/env python3
import subprocess
import sys

def get_merged_branches():
    # Get remote branches merged into main
    cmd = ["git", "branch", "-r", "--merged", "main"]
    result = subprocess.run(cmd, capture_output=True, text=True)
    branches = []
    for line in result.stdout.splitlines():
        branch = line.strip()
        if "->" in branch: continue # Skip HEAD -> main
        if "origin/main" in branch: continue
        if "origin/release/" in branch: continue # Skip releases for safety
        if branch.startswith("origin/"):
            branches.append(branch.replace("origin/", ""))
    return branches

def delete_branches(branches):
    if not branches:
        print("No merged branches to delete.")
        return

    print(f"Found {len(branches)} merged branches to delete.")
    
    # Batch delete to be faster
    # git push origin --delete branch1 branch2 ...
    # But command line length limits might apply.
    # Let's do chunks of 10.
    
    chunk_size = 10
    for i in range(0, len(branches), chunk_size):
        chunk = branches[i:i + chunk_size]
        print(f"Deleting chunk {i//chunk_size + 1}: {chunk}")
        cmd = ["git", "push", "origin", "--delete"] + chunk
        subprocess.run(cmd)

if __name__ == "__main__":
    branches = get_merged_branches()
    delete_branches(branches)
