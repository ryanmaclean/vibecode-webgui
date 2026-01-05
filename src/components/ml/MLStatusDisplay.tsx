// src/components/ml/MLStatusDisplay.tsx
// Component to display CoreML/Apple Neural Engine status

'use client';

import { useMLAccelerator, MLDeviceInfo } from '@/hooks/useMLAccelerator';
import { useEffect, useState } from 'react';

export default function MLStatusDisplay() {
  const { isAvailable, deviceInfo, capabilities, isInitialized, initialize, error } = useMLAccelerator();
  const [isInitLoading, setIsInitLoading] = useState(false);

  const handleInitialize = async () => {
    setIsInitLoading(true);
    try {
      await initialize();
    } finally {
      setIsInitLoading(false);
    }
  };

  if (!isAvailable) {
    return (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-800 mb-2">
          ⚠️ ML Acceleration Not Available
        </h3>
        <p className="text-sm text-yellow-700">
          {error || 'CoreML is only available on macOS with Apple Silicon.'}
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-green-800">
          ✅ Apple Neural Engine Ready
        </h3>
        {!isInitialized && (
          <button
            onClick={handleInitialize}
            disabled={isInitLoading}
            className="px-3 py-1 text-xs bg-green-700 text-white rounded hover:bg-green-800 disabled:opacity-50"
          >
            {isInitLoading ? 'Initializing...' : 'Initialize'}
          </button>
        )}
      </div>

      {deviceInfo && (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="font-medium text-gray-700">Metal GPU:</span>{' '}
            <span className="text-gray-600">{deviceInfo.metalAvailable ? '✅' : '❌'}</span>
          </div>
          <div>
            <span className="font-medium text-gray-700">CoreML:</span>{' '}
            <span className="text-gray-600">{deviceInfo.coreMLAvailable ? '✅' : '❌'}</span>
          </div>
          {deviceInfo.neuralEngineAvailable && (
            <div className="col-span-2">
              <span className="font-medium text-gray-700">Neural Engine:</span>{' '}
              <span className="text-green-600">✅ Available</span>
            </div>
          )}
        </div>
      )}

      {isInitialized && (
        <div className="mt-2 text-xs text-green-700">
          🚀 ML accelerator initialized and ready
        </div>
      )}
    </div>
  );
}

