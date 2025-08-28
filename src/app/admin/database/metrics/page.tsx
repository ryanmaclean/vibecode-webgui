'use client';

import React from 'react';
import DatabaseConnectionMetrics from '@/components/DatabaseConnectionMetrics';

export default function DatabaseMetricsPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Database Connection Metrics</h1>
      <DatabaseConnectionMetrics refreshInterval={15000} />
    </div>
  );
}