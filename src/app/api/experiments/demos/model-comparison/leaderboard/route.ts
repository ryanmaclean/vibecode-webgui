import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { getModelLeaderboard } = await import('@/lib/experiments/scenarios/multi-model');
    const data = await getModelLeaderboard();
    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
