'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Globe, MapPin, User, Bot, Shield, Activity } from 'lucide-react';

export default function TestGeomapsPage() {
  const [lastEvent, setLastEvent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const sendTestEvent = async (eventType: string, metadata: any = {}) => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login-tracking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          event: eventType,
          userId: `test_user_${Date.now()}`,
          email: 'test@example.com',
          provider: 'test',
          sessionId: `session_${Date.now()}`,
          loginMethod: 'test_interface',
          ...metadata,
        }),
      });

      const result = await response.json();
      setLastEvent(`${eventType}: ${result.message}`);
    } catch (error) {
      setLastEvent(`Error: ${error}`);
    }
    setIsLoading(false);
  };

  return (
    <div className="container mx-auto p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-4 flex items-center gap-3">
          🗺️ Datadog Geomap Testing
          <Badge variant="outline">Geographic Tracking</Badge>
        </h1>
        <p className="text-muted-foreground">
          Test geographic logging for Datadog geomaps. These events will show up in your Datadog dashboard with 
          automatic IP geolocation enrichment.
        </p>
      </div>

      {/* Test Events */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5" />
            Generate Test Events
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button
              onClick={() => sendTestEvent('login_success')}
              disabled={isLoading}
              className="flex items-center gap-2"
              variant="default"
            >
              <User className="w-4 h-4" />
              Login Success
            </Button>
            
            <Button
              onClick={() => sendTestEvent('login_failure')}
              disabled={isLoading}
              className="flex items-center gap-2"
              variant="destructive"
            >
              <User className="w-4 h-4" />
              Login Failure
            </Button>
            
            <Button
              onClick={() => sendTestEvent('login_attempt')}
              disabled={isLoading}
              className="flex items-center gap-2"
              variant="outline"
            >
              <Shield className="w-4 h-4" />
              Login Attempt
            </Button>
            
            <Button
              onClick={() => sendTestEvent('logout')}
              disabled={isLoading}
              className="flex items-center gap-2"
              variant="secondary"
            >
              <User className="w-4 h-4" />
              Logout
            </Button>
          </div>
          
          {lastEvent && (
            <div className="mt-4 p-3 bg-muted rounded border">
              <p className="text-sm font-medium">Last Event:</p>
              <p className="text-sm text-muted-foreground">{lastEvent}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Geographic Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Your Geographic Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-500" />
              <span className="text-sm">
                Your IP will be automatically enriched with geographic data by Datadog
              </span>
            </div>
            <div className="text-sm text-muted-foreground">
              Fields that will be populated:
              <ul className="list-disc list-inside ml-4 mt-2">
                <li><code>@geo.country_name</code> - Your country</li>
                <li><code>@geo.country_code</code> - Country code (US, UK, etc.)</li>
                <li><code>@geo.city_name</code> - Your city</li>
                <li><code>@geo.region_name</code> - State/region</li>
                <li><code>@network.client.ip</code> - Your IP address</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bot Protection Testing */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Bot Protection Active
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm">
              This page is protected by our Datadog-integrated bot detection middleware.
              Your access is being logged for geographic analysis.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-3 border rounded">
                <h4 className="font-medium text-sm mb-1">Real-time Detection</h4>
                <p className="text-xs text-muted-foreground">
                  Bot patterns analyzed on every request
                </p>
              </div>
              <div className="p-3 border rounded">
                <h4 className="font-medium text-sm mb-1">Geographic Tracking</h4>
                <p className="text-xs text-muted-foreground">
                  IP addresses enriched with location data
                </p>
              </div>
              <div className="p-3 border rounded">
                <h4 className="font-medium text-sm mb-1">Datadog Integration</h4>
                <p className="text-xs text-muted-foreground">
                  All events streamed to Datadog dashboards
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard Links */}
      <Card>
        <CardHeader>
          <CardTitle>Datadog Dashboard</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              After generating test events, check your Datadog dashboard for:
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 ml-4">
              <li><strong>User Login Geomap:</strong> Geographic distribution of login events</li>
              <li><strong>Bot Traffic Geomap:</strong> Geographic sources of bot activity</li>
              <li><strong>Page Visits Geomap:</strong> Legitimate user access patterns</li>
              <li><strong>Real-time Activity Stream:</strong> Live feed of all events with geo data</li>
            </ul>
            
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
              <p className="text-sm text-blue-800">
                <strong>Pro Tip:</strong> Import the dashboard configuration from 
                <code className="ml-1 px-1 bg-blue-100 rounded">datadog-bot-protection-dashboard.json</code> 
                to visualize your geographic data.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 