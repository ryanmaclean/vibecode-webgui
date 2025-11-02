import type { NextResponse } from 'next/server';

export function createErrorResponseFromError(error: unknown, status?: number, message?: string, requestId?: string): NextResponse;
