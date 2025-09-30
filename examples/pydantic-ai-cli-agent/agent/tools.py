"""File system and code tools for the agent"""

import asyncio
import subprocess
from pathlib import Path
from typing import List


async def read_file(file_path: Path) -> str:
    """Read contents of a file"""
    try:
        content = file_path.read_text()
        return f"File: {file_path}\n\n{content}"
    except FileNotFoundError:
        return f"Error: File not found: {file_path}"
    except Exception as e:
        return f"Error reading file: {e}"


async def write_file(file_path: Path, content: str) -> str:
    """Write or update a file"""
    try:
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)
        return f"✓ Wrote {len(content)} characters to {file_path}"
    except Exception as e:
        return f"Error writing file: {e}"


async def list_files(directory: Path, max_depth: int = 2) -> str:
    """List files in a directory"""
    try:
        if not directory.exists():
            return f"Error: Directory not found: {directory}"
        
        files: List[str] = []
        for item in directory.rglob('*'):
            if item.is_file():
                rel_path = item.relative_to(directory)
                if len(rel_path.parts) <= max_depth:
                    files.append(str(rel_path))
        
        if not files:
            return f"No files found in {directory}"
        
        return f"Files in {directory}:\n" + "\n".join(f"  - {f}" for f in sorted(files))
    except Exception as e:
        return f"Error listing files: {e}"


async def search_files(base_path: Path, pattern: str) -> str:
    """Search for files matching pattern"""
    try:
        matches = list(base_path.glob(pattern))
        if not matches:
            return f"No files matching '{pattern}'"
        
        return "Matching files:\n" + "\n".join(f"  - {m.relative_to(base_path)}" for m in matches)
    except Exception as e:
        return f"Error searching files: {e}"


async def delete_file(file_path: Path) -> str:
    """Delete a file"""
    try:
        if not file_path.exists():
            return f"Error: File not found: {file_path}"
        
        file_path.unlink()
        return f"✓ Deleted {file_path}"
    except Exception as e:
        return f"Error deleting file: {e}"


async def run_command(command: str, cwd: Path) -> str:
    """Run a shell command"""
    try:
        process = await asyncio.create_subprocess_shell(
            command,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        stdout, stderr = await process.communicate()
        
        output = []
        if stdout:
            output.append(f"Output:\n{stdout.decode()}")
        if stderr:
            output.append(f"Errors:\n{stderr.decode()}")
        if process.returncode != 0:
            output.append(f"Exit code: {process.returncode}")
        
        return "\n".join(output) if output else "Command completed successfully"
    except Exception as e:
        return f"Error running command: {e}"
