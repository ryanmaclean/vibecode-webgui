#!/usr/bin/env python3


"""Simple Ralph-loop runner for Codex or Ollama backends."""
from __future__ import annotations
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

import argparse
import os
import re
import shlex
import subprocess
import sys
import time
from typing import Optional


def run_cmd(cmd: list[str]) -> tuple[int, str, str]:
    proc = subprocess.run(cmd, text=True, capture_output=True)
    return proc.returncode, proc.stdout, proc.stderr


def run_codex(prompt: str, model: Optional[str], use_oss: bool, provider: Optional[str], sandbox: str) -> tuple[int, str, str, list[str]]:
    # codex exec accepts only a subset of top-level flags; avoid unsupported ones.
    cmd = ["codex", "exec", prompt, "--sandbox", sandbox]
    if model:
        cmd += ["--model", model]
    if use_oss:
        cmd.append("--oss")
        if provider:
            cmd += ["--local-provider", provider]
    returncode, out, err = run_cmd(cmd)
    return returncode, out, err, cmd


def run_ollama(prompt: str, model: str) -> tuple[int, str, str, list[str]]:
    cmd = ["ollama", "run", model, prompt]
    returncode, out, err = run_cmd(cmd)
    return returncode, out, err, cmd


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a Ralph loop using Codex or Ollama.")
    parser.add_argument("--backend", choices=["codex", "codex-oss", "ollama"], required=True)
    parser.add_argument("--model", help="Model name (Codex or Ollama).")
    parser.add_argument("--prompt", help="Prompt text (inline).")
    parser.add_argument("--prompt-file", help="Path to prompt file.")
    parser.add_argument("--completion-text", help="Text that must appear to finish.")
    parser.add_argument("--completion-regex", help="Regex that must match to finish.")
    parser.add_argument("--max-iterations", type=int, default=10)
    parser.add_argument("--sleep-seconds", type=int, default=5)
    parser.add_argument("--verify-cmd", help="Optional shell command; must exit 0 to finish.")
    parser.add_argument("--sandbox", default="read-only", help="Codex sandbox mode.")
    parser.add_argument("--oss-provider", default="ollama", help="Codex OSS provider (ollama|lmstudio|ollama-chat).")
    args = parser.parse_args()

    if not args.prompt and not args.prompt_file:
        print("Error: --prompt or --prompt-file required", file=sys.stderr)
        return 2

    if args.prompt_file:
        with open(args.prompt_file, "r", encoding="utf-8") as f:
            prompt = f.read().strip()
    else:
        prompt = args.prompt.strip()

    if not prompt:
        print("Error: prompt is empty", file=sys.stderr)
        return 2

    if args.backend in {"ollama", "codex-oss"} and not args.model:
        print("Error: --model is required for ollama/codex-oss", file=sys.stderr)
        return 2

    completion_re = re.compile(args.completion_regex) if args.completion_regex else None

    for iteration in range(1, args.max_iterations + 1):
        print(f"\n=== Ralph Loop Iteration {iteration}/{args.max_iterations} ===")

        if args.backend == "codex":
            rc, out, err, cmd = run_codex(prompt, args.model, False, None, args.sandbox)
        elif args.backend == "codex-oss":
            rc, out, err, cmd = run_codex(prompt, args.model, True, args.oss_provider, args.sandbox)
        else:
            rc, out, err, cmd = run_ollama(prompt, args.model)

        print("Command:", " ".join(shlex.quote(c) for c in cmd))
        if err:
            print("--- stderr ---")
            print(err.rstrip())
        print("--- stdout ---")
        print(out.rstrip())

        if rc != 0:
            print(f"Exit code {rc}; continuing...")
        else:
            done = False
            if args.completion_text and args.completion_text in out:
                done = True
            if completion_re and completion_re.search(out):
                done = True
            if not args.completion_text and not completion_re:
                # If no completion condition provided, treat a clean run as completion.
                done = True

            if done:
                if args.verify_cmd:
                    print("Running verify command...")
                    vrc = subprocess.run(args.verify_cmd, shell=True).returncode
                    if vrc == 0:
                        print("Verification passed. Ralph loop complete.")
                        return 0
                    print(f"Verification failed (exit {vrc}); continuing.")
                else:
                    print("Completion condition met. Ralph loop complete.")
                    return 0

        time.sleep(args.sleep_seconds)

    print("Max iterations reached without completion.")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())