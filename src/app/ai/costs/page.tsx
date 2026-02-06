'use client'

import { useState } from 'react'
import CostDashboard from '@/components/ai/CostDashboard'
import CostEstimator from '@/components/ai/CostEstimator'
import { Button } from '@/components/ui/button'
import { Calculator, X } from 'lucide-react'

export default function AICostsPage() {
  const [showEstimator, setShowEstimator] = useState(false)
  const [estimatorMessage, setEstimatorMessage] = useState('')
  const [estimatorModel, setEstimatorModel] = useState('gpt-4o')

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">AI Costs</h1>
          <p className="mt-1 text-gray-600">
            Monitor spending, set budgets, and estimate costs across AI models
          </p>
        </div>
        <Button
          variant={showEstimator ? 'secondary' : 'default'}
          onClick={() => setShowEstimator(!showEstimator)}
        >
          {showEstimator ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Close Estimator
            </>
          ) : (
            <>
              <Calculator className="h-4 w-4 mr-2" />
              Cost Estimator
            </>
          )}
        </Button>
      </div>

      {/* Cost Estimator Panel */}
      {showEstimator && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Quick Cost Estimate</h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="estimator-model" className="block text-sm font-medium text-gray-700 mb-1">
                Model
              </label>
              <select
                id="estimator-model"
                value={estimatorModel}
                onChange={(e) => setEstimatorModel(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <optgroup label="OpenAI">
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4-turbo">GPT-4 Turbo</option>
                </optgroup>
                <optgroup label="Anthropic">
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="claude-3-haiku">Claude 3 Haiku</option>
                  <option value="claude-3-opus">Claude 3 Opus</option>
                </optgroup>
                <optgroup label="Google">
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  <option value="gemini-1.5-flash">Gemini 1.5 Flash</option>
                </optgroup>
                <optgroup label="Other">
                  <option value="deepseek-v3">DeepSeek V3</option>
                  <option value="llama-3.1-70b">Llama 3.1 70B</option>
                  <option value="mistral-large">Mistral Large</option>
                </optgroup>
              </select>
            </div>
            <div>
              <label htmlFor="estimator-message" className="block text-sm font-medium text-gray-700 mb-1">
                Sample Message
              </label>
              <textarea
                id="estimator-message"
                value={estimatorMessage}
                onChange={(e) => setEstimatorMessage(e.target.value)}
                placeholder="Paste a sample prompt to estimate its cost..."
                rows={4}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            {estimatorMessage.trim().length > 0 && (
              <CostEstimator
                message={estimatorMessage}
                selectedModel={estimatorModel}
                onModelSelect={setEstimatorModel}
                expandedByDefault={true}
                showComparison={true}
              />
            )}
          </div>
        </div>
      )}

      {/* Main Cost Dashboard */}
      <CostDashboard refreshInterval={30000} showSettings={true} />
    </div>
  )
}
