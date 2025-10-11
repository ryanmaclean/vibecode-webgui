---
title: DOCKER MODEL RUNNER SETUP
description: DOCKER MODEL RUNNER SETUP documentation
---

# Docker Model Runner Setup for VibeCode

This guide explains how to set up Docker Model Runner for local AI inference in VibeCode, based on Docker's latest AI capabilities.

## Prerequisites

- Docker Desktop 4.40+ (for macOS on Apple Silicon)
- Docker Model Runner enabled

## Quick Setup

### 1. Enable Docker Model Runner

```bash
# Enable Model Runner (if not already enabled)
docker desktop enable model-runner

# Enable TCP access for host processes
docker desktop enable model-runner --tcp 12434
```

### 2. Pull Some Models

```bash
# Pull the models mentioned in our configuration
docker model pull ai/smollm2:360M-Q4_K_M
docker model pull ai/llama3.2:1b-Q4_K_M  
docker model pull ai/qwen2.5-coder:1.5b-Q4_K_M

# Optional: Pull Whisper for voice transcription
docker model pull ai/whisper:base-Q4_K_M
```

### 3. Test Model Runner

```bash
# Test a simple query
docker model run ai/smollm2:360M-Q4_K_M "Write a simple Hello World in JavaScript"

# Check available models
curl http://localhost:12434/engines/v1/models
```

### 4. Start VibeCode with AI Integration

```bash
# Start all services including Model Runner integration
docker-compose up -d

# Check that all services are healthy
docker-compose ps
```

## Available Services

Once running, you'll have:

- **VibeCode Main App**: http://localhost:3000
- **Docker Model Runner**: http://localhost:12434 
- **MCP Servers**: http://localhost:3001-3003
- **Voice Processor**: http://localhost:3004
- **Code Server**: http://localhost:8080

## Features

### Voice Input in Safari

The chat interface now supports:
- **Real-time speech recognition** using Safari's Web Speech API
- **Audio recording** with waveform visualization  
- **Automatic transcription** via Docker Model Runner
- **File upload** for audio files

### Local AI Models

VibeCode integrates these local models via Docker Model Runner:
- **SmolLM2 360M**: Fast, lightweight general model
- **Llama 3.2 1B**: Balanced performance and speed
- **Qwen2.5 Coder 1.5B**: Specialized for code generation

### MCP Tool Integration

Model Context Protocol servers provide:
- **File System**: Read/write workspace files
- **Database**: Query and modify data
- **Web Search**: Search and extract web content
- **Voice Processing**: Audio transcription and analysis

## Voice Interface Testing

1. **Open VibeCode** in Safari (best Web Speech API support)
2. **Click the microphone icon** for real-time speech-to-text
3. **Click the recording icon** to record audio for upload
4. **Upload audio files** for transcription via Docker Model Runner

## Model Selection

The interface allows switching between:
- **Local models** (free, fast, private)
- **Cloud models** (more capable, costs money)

Local models run entirely on your machine via Docker Model Runner.

## Troubleshooting

### Model Runner Not Available
```bash
# Check if Model Runner is enabled
docker desktop status

# Restart if needed
docker desktop restart
```

### Models Not Loading
```bash
# Check model list
docker model list

# Pull missing models
docker model pull ai/smollm2:360M-Q4_K_M
```

### Voice Features Not Working
- Ensure you're using Safari (best Web Speech API support)
- Grant microphone permissions when prompted
- Check voice processor service: `curl http://localhost:3004/health`

### MCP Servers Disconnected
```bash
# Check MCP server logs
docker logs vibecode-mcp-servers

# Restart MCP services
docker-compose restart mcp-servers
```

## Architecture

```
VibeCode UI (React + Voice)
    ↓
Docker Model Runner (Local AI)
    ↓  
MCP Servers (Tools & Functions)
    ↓
Your Code & Files
```

This setup gives you a complete AI-powered development environment with voice input, running entirely on your local machine via Docker! 