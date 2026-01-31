#!/usr/bin/env python3
"""
AI Extensions Configuration Script

Configures AI coding extension settings for code-server.

Usage:
    python configure_ai_extensions.py
"""

import json
import os
import subprocess
import sys
from pathlib import Path


def ensure_directory(path: Path) -> None:
    """Create directory if it doesn't exist."""
    path.mkdir(parents=True, exist_ok=True)


def get_ai_settings() -> dict:
    """Get the AI extension settings configuration."""
    return {
        "github.copilot.enable": {
            "*": True,
            "yaml": True,
            "plaintext": True,
            "markdown": True,
        },
        "github.copilot.autocomplete.enable": True,
        "github.copilot.inlineSuggest.enable": True,
        "github.copilot.suggestions.autoAccept": False,
        "github.copilot.advanced": {
            "debug.overrideEngine": "codex",
            "debug.testOverrideProxyUrl": "",
            "debug.overrideProxyUrl": "",
        },
        "codeium.enableSearch": True,
        "codeium.enableCompletions": True,
        "codeium.enableTabCompletion": True,
        "tabnine.enable_power_saving_mode": True,
        "tabnine.receiveBetaChannelUpdates": False,
        "tabnine.disable_auto_completions": False,
        "tabnine.disable_line_suggestions_across_syntax": False,
        "tabnine.disable_personalization": False,
        "tabnine.enable_ai_supported_completions": True,
        "tabnine.enable_ai_supported_completions_ranking": True,
        "tabnine.enable_deep_completions": True,
        "tabnine.enable_line_suggestions": True,
        "tabnine.enable_white_black_list": True,
        "tabnine.experimentalAutoImportEnabled": True,
        "tabnine.rate_limit_interval_seconds": 30,
        "tabnine.rate_limit_count": 30,
        "aws.telemetry": True,
        "aws.telemetryUser": "vibecode",
        "aws.experimental.activateOnLanguageIds": [
            "python", "javascript", "typescript", "java", "csharp", "go"
        ],
        "aws.experimental.autoEnableCodeLenses": True,
        "aws.experimental.autoEnableInlineCompletion": True,
        "aws.experimental.autoSuggestEnabled": True,
        "aws.experimental.completionContributorDebounceMillis": 0,
        "aws.experimental.completionDebounceMillis": 0,
        "aws.experimental.enableCodeLenses": True,
        "aws.experimental.enableCodeWithMe": True,
        "aws.experimental.enableInlineCompletion": True,
        "aws.experimental.enableReferenceCodeLens": True,
        "aws.experimental.enableReferenceHover": True,
        "aws.experimental.enableReferenceTraceView": True,
        "aws.experimental.enableReferenceFindings": True,
        "aws.experimental.enableReferenceLogs": True,
        "aws.experimental.maxItemsToScan": 1000,
        "aws.experimental.maxSuggestions": 10,
        "aws.experimental.minLineContext": 5,
        "aws.experimental.minLineContextForSuggestions": 5,
        "aws.experimental.showReferenceCountInStatusBar": True,
        "aws.experimental.suppressNotifications": False,
        "aws.experimental.telemetryEnabled": True,
        "cody.debug.enable": True,
        "cody.debug.verbose": False,
        "cody.experimental.symf.enabled": True,
        "cody.experimental.simpleChatContext": True,
        "cody.experimental.noodle.enabled": True,
        "cody.experimental.guardrails": True,
        "cody.experimental.localSymbols": True,
        "cody.experimental.symf.path": "/usr/local/bin/symf",
        "cody.serverEndpoint": "https://sourcegraph.com",
        "cody.customConfiguration": {
            "customHeaders": {
                "Cache-Control": "no-cache",
                "X-Sourcegraph-Should-Trace": "false",
            },
            "embeddings": True,
            "experimentalSuggest": True,
            "experimentalTracing": False,
            "inline": True,
            "keyword.enabled": True,
            "maxFileSize": 1000000,
            "maxTextSize": 100000,
            "useContext": "embeddings",
        },
        "continue.serverUrl": "http://localhost:3000",
        "continue.enableTabAutocomplete": True,
        "continue.autoCompleteMaxTokens": 512,
        "continue.showContextFiles": True,
        "continue.showTokenCount": True,
        "continue.showFileButtons": True,
        "continue.autoCompleteRejectSnippetInsertion": False,
        "continue.showFileIcon": True,
        "continue.showImage": True,
        "continue.showDiff": True,
        "continue.showFullFileDiff": True,
        "continue.autoCompleteDelay": 200,
        "continue.autoCompleteModels": {
            "default": "claude-3-sonnet-20240229",
            "small": "gpt-3.5-turbo",
            "large": "claude-3-opus-20240229",
        },
        "continue.tabAutocompleteModel": "claude-3-haiku-20240307",
    }


def install_symf() -> bool:
    """Install symf for Cody symbol search."""
    symf_path = Path("/usr/local/bin/symf")

    if symf_path.exists():
        print("symf already installed")
        return True

    print("Installing symf for Cody...")
    try:
        result = subprocess.run([
            "curl", "-L",
            "https://github.com/sourcegraph/symf/releases/latest/download/symf-linux-amd64",
            "-o", str(symf_path),
        ], check=True)

        symf_path.chmod(0o755)
        print("symf installed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Failed to install symf: {e}")
        return False
    except PermissionError:
        print("Permission denied: unable to install symf (run as root)")
        return False


def configure_ai_extensions(home_dir: str = "/home/coder") -> int:
    """Configure AI extensions."""
    home = Path(home_dir)

    # Create settings directory
    settings_dir = home / ".local" / "share" / "code-server" / "User"
    ensure_directory(settings_dir)

    vscode_dir = home / ".vscode"
    ensure_directory(vscode_dir)

    # Write settings
    settings_path = settings_dir / "settings.json"
    settings = get_ai_settings()

    with open(settings_path, "w") as f:
        json.dump(settings, f, indent=4)

    print(f"Settings written to {settings_path}")

    # Set permissions
    try:
        import pwd
        coder_uid = pwd.getpwnam("coder").pw_uid
        coder_gid = pwd.getpwnam("coder").pw_gid

        for path in [settings_dir, settings_path, vscode_dir]:
            os.chown(path, coder_uid, coder_gid)

        # Recursively set ownership
        for root, dirs, files in os.walk(home / ".local" / "share" / "code-server"):
            for d in dirs:
                os.chown(os.path.join(root, d), coder_uid, coder_gid)
            for f in files:
                os.chown(os.path.join(root, f), coder_uid, coder_gid)

    except (KeyError, PermissionError):
        print("Warning: Could not set ownership (may not be running as root)")

    # Install symf
    install_symf()

    print("AI extensions configuration complete!")
    return 0


def main() -> int:
    """Main entry point."""
    return configure_ai_extensions()


if __name__ == "__main__":
    sys.exit(main())
