# VibeCode AI Assistant

A powerful VS Code extension that provides multi-provider AI coding assistance through OpenRouter integration. Get help with code generation, debugging, optimization, and more from leading AI models including Claude, GPT-4, Gemini, and others.

## Features

### 🤖 Multi-Provider AI Models
- **Anthropic Claude 3** (Sonnet, Haiku)
- **OpenAI GPT-4** (Turbo, GPT-3.5)
- **Google Gemini Pro**
- **Mistral Large**
- **Meta Llama 3**
- **And many more via OpenRouter**

### 💡 Intelligent Code Assistance
- **Code Generation**: Generate code from natural language descriptions
- **Code Explanation**: Understand complex code with AI-powered explanations
- **Code Optimization**: Improve performance and readability
- **Bug Fixing**: Get intelligent suggestions for fixing code issues
- **Test Generation**: Automatically generate comprehensive test suites

### 🚀 Advanced Features
- **Project Generation**: Create entire projects from descriptions (Lovable/Replit/Bolt.diy workflow)
- **Live Workspace Integration**: Generated projects open directly in code-server
- **Interactive Chat**: Chat with AI about your code with context awareness
- **Streaming Responses**: Get real-time AI responses as they're generated
- **Context Awareness**: AI understands your current file and selection
- **Multiple Languages**: Support for all major programming languages

### 🎯 Smart Integration
- **Right-click Context Menu**: Access AI features directly from editor
- **Keyboard Shortcuts**: Quick access to common operations
- **Activity Bar**: Dedicated AI chat panel
- **Command Palette**: Full command access via Ctrl+Shift+P

## Installation

1. Install the extension from the VS Code marketplace
2. Get your OpenRouter API key from [openrouter.ai](https://openrouter.ai)
3. Configure the API key in VS Code settings

## Configuration

Go to VS Code Settings (Ctrl+,) and search for "VibeCode" to configure:

```json
{
  "vibecode.openRouterApiKey": "your-openrouter-api-key",
  "vibecode.defaultModel": "anthropic/claude-3-sonnet-20240229",
  "vibecode.maxTokens": 4000,
  "vibecode.temperature": 0.7,
  "vibecode.enableStreaming": true
}
```

### Available Models

- `anthropic/claude-3-sonnet-20240229` (Recommended)
- `anthropic/claude-3-haiku-20240307` (Fast)
- `openai/gpt-4-turbo-preview` (High quality)
- `openai/gpt-3.5-turbo` (Fast and efficient)
- `google/gemini-pro` (Google's latest)
- `mistral/mistral-large` (European AI)
- `meta-llama/llama-3-70b-instruct` (Open source)

## Usage

### Quick Start

1. **Set up API Key**: Go to Settings → Extensions → VibeCode AI Assistant
2. **Select Model**: Use `Ctrl+Shift+P` → "VibeCode: Select AI Model"
3. **Start Chatting**: Press `Ctrl+Shift+C` or click the robot icon

### Code Generation

1. Place cursor where you want to insert code
2. Use `Ctrl+Shift+G` or right-click → "Generate Code with AI"
3. Describe what you want to generate
4. Choose to insert at cursor, new line, or new document

### Code Explanation

1. Select code you want to understand
2. Use `Ctrl+Shift+E` or right-click → "Explain Code"
3. View detailed explanation in a new document

### Code Optimization

1. Select code to optimize
2. Right-click → "Optimize Code"
3. Review suggestions and improvements

### Test Generation

1. Select code to test
2. Right-click → "Generate Tests"
3. Choose your testing framework
4. Save generated tests

### Project Generation

1. Open an empty folder
2. Use Command Palette → "VibeCode: Generate Project from Description"
3. Describe your project requirements
4. Select project type
5. Watch as your complete project is generated

### Interactive Chat

1. Click the robot icon in the activity bar or press `Ctrl+Shift+C`
2. Type your questions or requests
3. Toggle "Include code context" to provide current file context
4. Get intelligent responses with code examples

## Keyboard Shortcuts

- `Ctrl+Shift+G` (Cmd+Shift+G on Mac): Generate Code
- `Ctrl+Shift+E` (Cmd+Shift+E on Mac): Explain Code
- `Ctrl+Shift+C` (Cmd+Shift+C on Mac): Open AI Chat

## Commands

All commands are available via Command Palette (Ctrl+Shift+P):

- `VibeCode: Generate Code with AI`
- `VibeCode: Explain Code`
- `VibeCode: Optimize Code`
- `VibeCode: Fix Code Issues`
- `VibeCode: Generate Tests`
- `VibeCode: Generate Project from Description`
- `VibeCode: Chat with AI about Code`
- `VibeCode: Select AI Model`

## Privacy & Security

- **No Code Collection**: Your code is never stored or logged
- **Direct API Communication**: Connects directly to OpenRouter
- **Configurable Telemetry**: Anonymous usage statistics (disabled by default)
- **Local Processing**: All operations happen locally or via secure API calls

## Requirements

- VS Code 1.85.0 or later
- OpenRouter API key
- Internet connection for AI model access

## Known Issues

- Large projects may take time to generate
- Some models have rate limits
- Network connectivity required for all AI features

## Contributing

This extension is part of the VibeCode platform. Contributions are welcome!

## License

MIT License - see LICENSE file for details

## Support

- [GitHub Issues](https://github.com/vibecode/vibecode-webgui/issues)
- [Documentation](https://docs.vibecode.dev)
- [Community Discord](https://discord.gg/vibecode)

---

**Enjoy coding with AI! 🚀**
