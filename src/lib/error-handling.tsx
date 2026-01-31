// Global error handling utilities
import Link from 'next/link';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
  }
}

export class ServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500);
  }
}

// Error handler for API routes
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return new Response(
      JSON.stringify({
        error: error.message,
        statusCode: error.statusCode,
        timestamp: new Date().toISOString()
      }),
      {
        status: error.statusCode,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as { code?: string; meta?: { target?: string[] }; message?: string };
    switch (prismaError.code) {
      case 'P2002':
        return new Response(
          JSON.stringify({
            error: 'Resource already exists',
            statusCode: 409,
            timestamp: new Date().toISOString()
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      case 'P2025':
        return new Response(
          JSON.stringify({
            error: 'Resource not found',
            statusCode: 404,
            timestamp: new Date().toISOString()
          }),
          {
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          }
        );
    }
  }

  // Handle NextAuth errors
  if (error && typeof error === 'object' && 'type' in error) {
    const nextAuthError = error as { type?: string; code?: string; message?: string };
    if (nextAuthError.type === 'CredentialsSignin') {
      return new Response(
        JSON.stringify({
          error: 'Invalid credentials',
          statusCode: 401,
          timestamp: new Date().toISOString()
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Generic server error
  return new Response(
    JSON.stringify({
      error: 'Internal server error',
      statusCode: 500,
      timestamp: new Date().toISOString()
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

// Error boundary for React components
export function ErrorBoundary({ 
  error, 
  reset 
}: { 
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div>
          <h1 className="text-6xl font-bold text-red-600">Error</h1>
          <h2 className="mt-6 text-2xl font-extrabold text-gray-900">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {error.message || 'An unexpected error occurred'}
          </p>
          {process.env.NODE_ENV === 'development' && (
            <details className="mt-4 text-left">
              <summary className="cursor-pointer text-sm text-gray-500">
                Error Details
              </summary>
              <pre className="mt-2 text-xs text-gray-400 overflow-auto">
                {error.stack}
              </pre>
            </details>
          )}
        </div>
        <div className="mt-8 space-y-4">
          <button
            onClick={reset}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try again
          </button>
          <Link
            href="/"
            className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

// Global error handler for unhandled promise rejections
export function setupGlobalErrorHandling() {
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      // You could send this to an error reporting service
    });

    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // You could send this to an error reporting service
    });
  }
}
