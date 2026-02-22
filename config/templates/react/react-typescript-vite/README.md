# React + TypeScript + Vite Template

A modern, production-ready React application template with TypeScript, Vite, and integrated monitoring support.

## Features

- **React 18** - Latest React with concurrent features
- **TypeScript** - Type-safe development with full IDE support
- **Vite** - Lightning-fast HMR and optimized production builds
- **Monitoring** - Pre-configured Datadog/Prometheus integration
- **ESLint** - Code quality and consistency
- **Production-Ready** - Optimized build configuration

## How It Works

This template provides a minimal React application setup with modern tooling:

1. **Fast Development** - Vite's dev server provides instant hot module replacement (HMR) for rapid iteration
2. **Type Safety** - TypeScript catches errors at compile-time, improving code quality and maintainability
3. **Optimized Builds** - Vite automatically optimizes your production bundle with code splitting and tree shaking
4. **Monitoring** - Built-in observability with custom metrics, traces, and logs sent to Datadog or Prometheus

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn package manager

## How to Use

1. **Clone the repository and navigate to this directory.**

2. **Install dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Configure environment variables (optional):**
   - Copy `.env.example` to `.env`
   - Add your Datadog API key or Prometheus configuration if using monitoring

4. **Start the development server:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   The app will be available at `http://localhost:5173`

5. **Build for production:**
   ```bash
   npm run build
   # or
   yarn build
   ```

6. **Preview production build:**
   ```bash
   npm run preview
   # or
   yarn preview
   ```

## Project Structure

```
.
├── src/
│   ├── App.tsx          # Main application component
│   ├── main.tsx         # Application entry point
│   └── ...
├── public/              # Static assets
├── .env.example         # Environment variables template
├── index.html           # HTML template
├── package.json         # Dependencies and scripts
├── tsconfig.json        # TypeScript configuration
├── vite.config.ts       # Vite configuration
└── README.md            # This file
```

## Monitoring

This template includes monitoring configuration for:

- **Application Performance Monitoring (APM)** - Trace requests and identify bottlenecks
- **Custom Metrics** - Track component renders, API calls, and user interactions
- **Error Tracking** - Automatically capture and report errors
- **Real User Monitoring (RUM)** - Monitor actual user experience

To enable monitoring, set the following environment variables:

```bash
DD_API_KEY=your_datadog_api_key
DD_SITE=datadoghq.com
SERVICE_NAME=my-react-app
SERVICE_VERSION=1.0.0
DEPLOYMENT_ENVIRONMENT=production
```

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build optimized production bundle
- `npm run preview` - Preview production build locally
- `npm run lint` - Run ESLint to check code quality

## Next Steps

- Add routing with React Router
- Integrate state management (Redux, Zustand, or Jotai)
- Add UI component library (Material-UI, Chakra UI, or Ant Design)
- Implement authentication
- Add testing with Vitest and React Testing Library

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Vite Guide](https://vitejs.dev/guide/)
- [Datadog RUM Documentation](https://docs.datadoghq.com/real_user_monitoring/)
