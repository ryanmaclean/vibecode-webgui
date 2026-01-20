import { NextResponse } from 'next/server';

export const dynamic = 'force-static';
export const revalidate = 60;

export async function GET() {
  try {
    return NextResponse.json({ 
      status: 'healthy',
      message: 'Pool alerts endpoint is working',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
