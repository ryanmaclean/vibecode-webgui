#!/bin/bash

# Create directory for user settings if it doesn't exist
mkdir -p /home/coder/.local/share/code-server/User/

# Configure GitHub Copilot settings
cat > /home/coder/.local/share/code-server/User/settings.json << 'EOL'
{
    "github.copilot.enable": {
        "*": true,
        "yaml": true,
        "plaintext": true,
        "markdown": true
    },
    "github.copilot.autocomplete.enable": true,
    "github.copilot.inlineSuggest.enable": true,
    "github.copilot.suggestions.autoAccept": false,
    "github.copilot.advanced": {
        "debug.overrideEngine": "codex",
        "debug.testOverrideProxyUrl": "",
        "debug.overrideProxyUrl": ""
    },
    "codeium.enableSearch": true,
    "codeium.enableCompletions": true,
    "codeium.enableTabCompletion": true,
    "tabnine.enable_power_saving_mode": true,
    "tabnine.receiveBetaChannelUpdates": false,
    "tabnine.disable_auto_completions": false,
    "tabnine.disable_line_suggestions_across_syntax": false,
    "tabnine.disable_personalization": false,
    "tabnine.enable_ai_supported_completions": true,
    "tabnine.enable_ai_supported_completions_ranking": true,
    "tabnine.enable_deep_completions": true,
    "tabnine.enable_line_suggestions": true,
    "tabnine.enable_white_black_list": true,
    "tabnine.experimentalAutoImportEnabled": true,
    "tabnine.rate_limit_interval_seconds": 30,
    "tabnine.rate_limit_count": 30,
    "aws.telemetry": true,
    "aws.telemetryUser": "vibecode",
    "aws.experimental.activateOnLanguageIds": ["python", "javascript", "typescript", "java", "csharp", "go"],
    "aws.experimental.autoEnableCodeLenses": true,
    "aws.experimental.autoEnableInlineCompletion": true,
    "aws.experimental.autoSuggestEnabled": true,
    "aws.experimental.completionContributorDebounceMillis": 0,
    "aws.experimental.completionDebounceMillis": 0,
    "aws.experimental.enableCodeLenses": true,
    "aws.experimental.enableCodeWithMe": true,
    "aws.experimental.enableInlineCompletion": true,
    "aws.experimental.enableReferenceCodeLens": true,
    "aws.experimental.enableReferenceHover": true,
    "aws.experimental.enableReferenceTraceView": true,
    "aws.experimental.enableReferenceFindings": true,
    "aws.experimental.enableReferenceLogs": true,
    "aws.experimental.maxItemsToScan": 1000,
    "aws.experimental.maxSuggestions": 10,
    "aws.experimental.minLineContext": 5,
    "aws.experimental.minLineContextForSuggestions": 5,
    "aws.experimental.showReferenceCountInStatusBar": true,
    "aws.experimental.suppressNotifications": false,
    "aws.experimental.telemetryEnabled": true,
    "cody.debug.enable": true,
    "cody.debug.verbose": false,
    "cody.experimental.symf.enabled": true,
    "cody.experimental.simpleChatContext": true,
    "cody.experimental.noodle.enabled": true,
    "cody.experimental.guardrails": true,
    "cody.experimental.localSymbols": true,
    "cody.experimental.symf.path": "/usr/local/bin/symf",
    "cody.serverEndpoint": "https://sourcegraph.com",
    "cody.customConfiguration": {
        "customHeaders": {
            "Cache-Control": "no-cache",
            "X-Sourcegraph-Should-Trace": "false"
        },
        "embeddings": true,
        "experimentalSuggest": true,
        "experimentalTracing": false,
        "inline": true,
        "keyword.enabled": true,
        "maxFileSize": 1000000,
        "maxTextSize": 100000,
        "useContext": "embeddings"
    },
    "continue.serverUrl": "http://localhost:3000",
    "continue.enableTabAutocomplete": true,
    "continue.autoCompleteMaxTokens": 512,
    "continue.showContextFiles": true,
    "continue.showTokenCount": true,
    "continue.showFileButtons": true,
    "continue.autoCompleteRejectSnippetInsertion": false,
    "continue.showFileIcon": true,
    "continue.showImage": true,
    "continue.showDiff": true,
    "continue.showFullFileDiff": true,
    "continue.autoCompleteDelay": 200,
    "continue.autoCompleteModels": {
        "default": "claude-3-sonnet-20240229",
        "small": "gpt-3.5-turbo",
        "large": "claude-3-opus-20240229"
    },
    "continue.tabAutocompleteModel": "claude-3-haiku-20240307"
}
EOL

# Set proper permissions
chown -R coder:coder /home/coder/.local/share/code-server/
chown -R coder:coder /home/coder/.vscode/

# Install symf for Cody (symbol search)
if [ ! -f "/usr/local/bin/symf" ]; then
    curl -L https://github.com/sourcegraph/symf/releases/latest/download/symf-linux-amd64 -o /usr/local/bin/symf
    chmod +x /usr/local/bin/symf
fi

echo "AI extensions configuration complete!"
