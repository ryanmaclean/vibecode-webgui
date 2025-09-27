# Development Setup Guide

This guide helps you set up the VibeCode development environment.

## Prerequisites

- Node.js 18.18+ 
- npm 9.0+
- Docker (optional, for containerized services)

## Quick Setup

1. Clone the repository:
```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui
```

2. Install dependencies and setup development environment:
```bash
npm run setup
```

3. Copy environment configuration:
```bash
cp .env.local.example .env.local
```

4. Start the development server:
```bash
npm run dev
```

## Available Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Run linting
- `npm run type-check` - Run TypeScript checks

For more details, see the main [README.md](./README.md).