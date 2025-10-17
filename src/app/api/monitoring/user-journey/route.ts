/**
 * User Journey Tracking API
 * 
 * Tracks user navigation and interaction patterns
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface UserJourneyEvent {
  journey: string;
  timestamp: number;
  url: string;
  metadata?: Record<string, unknown>;
}

// In-memory storage (replace with database in production)
const journeyEvents: UserJourneyEvent[] = [];
const MAX_EVENTS = 10000;

export async function POST(request: NextRequest) {
  try {
    const event: UserJourneyEvent = await request.json();

    // Validate event
    if (!event.journey || !event.timestamp) {
      return NextResponse.json(
        { error: 'Invalid journey event' },
        { status: 400 }
      );
    }

    // Store event
    journeyEvents.push(event);

    // Keep only recent events
    if (journeyEvents.length > MAX_EVENTS) {
      journeyEvents.shift();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error storing journey event:', error);
    return NextResponse.json(
      { error: 'Failed to store event' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const journey = searchParams.get('journey');
    const since = searchParams.get('since');

    let filteredEvents = journeyEvents;

    // Filter by journey name
    if (journey) {
      filteredEvents = filteredEvents.filter(e => e.journey === journey);
    }

    // Filter by time
    if (since) {
      const sinceTime = parseInt(since);
      filteredEvents = filteredEvents.filter(e => e.timestamp >= sinceTime);
    }

    // Calculate journey statistics
    const stats = calculateJourneyStats(filteredEvents);

    return NextResponse.json({
      count: filteredEvents.length,
      events: filteredEvents.slice(-100),
      statistics: stats
    });
  } catch (error) {
    console.error('Error retrieving journey events:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve events' },
      { status: 500 }
    );
  }
}

function calculateJourneyStats(events: UserJourneyEvent[]) {
  if (events.length === 0) return null;

  const byJourney: Record<string, number> = {};
  const byUrl: Record<string, number> = {};

  events.forEach(e => {
    byJourney[e.journey] = (byJourney[e.journey] || 0) + 1;
    byUrl[e.url] = (byUrl[e.url] || 0) + 1;
  });

  return {
    totalEvents: events.length,
    uniqueJourneys: Object.keys(byJourney).length,
    uniqueUrls: Object.keys(byUrl).length,
    topJourneys: Object.entries(byJourney)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count })),
    topUrls: Object.entries(byUrl)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([url, count]) => ({ url, count }))
  };
}
