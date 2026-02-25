import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { askMultiModel } = await import('@/lib/experiments/scenarios/multi-model');
    const body = await request.json();
    const userId = String(body?.userId ?? '').trim();
    const question = String(body?.question ?? '').trim();

    if (!userId || !question) {
      return NextResponse.json({ error: 'Missing userId or question' }, { status: 400 });
    }

    const data = await askMultiModel({ userId, question });
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
