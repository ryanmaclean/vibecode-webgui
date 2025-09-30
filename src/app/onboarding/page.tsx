'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type OnboardingStep = 'welcome' | 'theme' | 'editor' | 'extensions' | 'integrations' | 'complete'

interface OnboardingData {
  theme: 'light' | 'dark' | 'auto'
  cliEditor: 'vim' | 'neovim' | 'emacs' | 'nano' | 'none'
  extensions: string[]
  integrations: {
    github?: boolean
    gitlab?: boolean
    jira?: boolean
    linear?: boolean
    openai?: boolean
    anthropic?: boolean
    codeium?: boolean
  }
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const [data, setData] = useState<OnboardingData>({
    theme: 'auto',
    cliEditor: 'none',
    extensions: [],
    integrations: {},
  })

  const updateData = (updates: Partial<OnboardingData>) => {
    setData({ ...data, ...updates })
  }

  const nextStep = () => {
    const steps: OnboardingStep[] = ['welcome', 'theme', 'editor', 'extensions', 'integrations', 'complete']
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const prevStep = () => {
    const steps: OnboardingStep[] = ['welcome', 'theme', 'editor', 'extensions', 'integrations', 'complete']
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const completeOnboarding = async () => {
    // Save preferences
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full p-8">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between mb-2">
            {['Welcome', 'Theme', 'Editor', 'Extensions', 'Integrations'].map((label, i) => (
              <span
                key={label}
                className={`text-xs ${
                  i <= ['welcome', 'theme', 'editor', 'extensions', 'integrations'].indexOf(step)
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-gray-400'
                }`}
              >
                {label}
              </span>
            ))}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{
                width: `${
                  (['welcome', 'theme', 'editor', 'extensions', 'integrations', 'complete'].indexOf(step) / 5) * 100
                }%`,
              }}
            />
          </div>
        </div>

        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Welcome to VibeCode 🚀
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              Let's get you set up in under 2 minutes
            </p>
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {/* Theme Step */}
        {step === 'theme' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Choose Your Theme</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Pick what's easiest on your eyes</p>
            <div className="grid grid-cols-3 gap-4 mb-8">
              {[
                { value: 'light', label: 'Light', emoji: '☀️' },
                { value: 'dark', label: 'Dark', emoji: '🌙' },
                { value: 'auto', label: 'Auto', emoji: '🔄' },
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => updateData({ theme: theme.value as any })}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    data.theme === theme.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="text-4xl mb-2">{theme.emoji}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{theme.label}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* CLI Editor Step */}
        {step === 'editor' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">CLI Editor Preference</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">For terminal work (optional)</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              {[
                { value: 'vim', label: 'Vim', desc: 'Classic modal editor' },
                { value: 'neovim', label: 'Neovim', desc: 'Modern Vim fork' },
                { value: 'emacs', label: 'Emacs', desc: 'Extensible editor' },
                { value: 'nano', label: 'Nano', desc: 'Simple & easy' },
                { value: 'none', label: 'Skip', desc: 'Browser only' },
              ].map((editor) => (
                <button
                  key={editor.value}
                  onClick={() => updateData({ cliEditor: editor.value as any })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.cliEditor === editor.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">{editor.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{editor.desc}</div>
                </button>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Extensions Step */}
        {step === 'extensions' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Recommended Extensions</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Based on your codebase</p>
            <div className="space-y-3 mb-8 max-h-96 overflow-y-auto">
              {[
                { id: 'prettier', name: 'Prettier', desc: 'Code formatter', recommended: true },
                { id: 'eslint', name: 'ESLint', desc: 'JavaScript linter', recommended: true },
                { id: 'gitlens', name: 'Git Graph', desc: 'Visual git history', recommended: true },
                { id: 'errorlens', name: 'Error Lens', desc: 'Inline errors', recommended: true },
                { id: 'jest', name: 'Jest', desc: 'Test runner', recommended: false },
                { id: 'docker', name: 'Docker', desc: 'Container tools', recommended: false },
                { id: 'kubernetes', name: 'Kubernetes', desc: 'K8s tools', recommended: false },
              ].map((ext) => (
                <label
                  key={ext.id}
                  className="flex items-center p-4 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={data.extensions.includes(ext.id)}
                    onChange={(e) => {
                      const newExts = e.target.checked
                        ? [...data.extensions, ext.id]
                        : data.extensions.filter((id) => id !== ext.id)
                      updateData({ extensions: newExts })
                    }}
                    className="w-5 h-5 text-indigo-600 rounded"
                  />
                  <div className="ml-3 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-white">{ext.name}</span>
                      {ext.recommended && (
                        <span className="text-xs bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded">
                          Recommended
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{ext.desc}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Integrations Step */}
        {step === 'integrations' && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Tools</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">Link services you use daily</p>
            <div className="space-y-4 mb-8">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Code Hosting</h3>
                <div className="space-y-2">
                  {[
                    { id: 'github', name: 'GitHub', icon: '🐙' },
                    { id: 'gitlab', name: 'GitLab', icon: '🦊' },
                  ].map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={data.integrations[service.id as keyof typeof data.integrations]}
                        onChange={(e) =>
                          updateData({
                            integrations: { ...data.integrations, [service.id]: e.target.checked },
                          })
                        }
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                      <span className="ml-3 text-2xl">{service.icon}</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Project Management</h3>
                <div className="space-y-2">
                  {[
                    { id: 'jira', name: 'Jira', icon: '📋' },
                    { id: 'linear', name: 'Linear', icon: '⚡' },
                  ].map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={data.integrations[service.id as keyof typeof data.integrations]}
                        onChange={(e) =>
                          updateData({
                            integrations: { ...data.integrations, [service.id]: e.target.checked },
                          })
                        }
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                      <span className="ml-3 text-2xl">{service.icon}</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-3">AI Services</h3>
                <div className="space-y-2">
                  {[
                    { id: 'openai', name: 'OpenAI', icon: '🤖' },
                    { id: 'anthropic', name: 'Anthropic', icon: '🧠' },
                    { id: 'codeium', name: 'Codeium', icon: '✨' },
                  ].map((service) => (
                    <label
                      key={service.id}
                      className="flex items-center p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={data.integrations[service.id as keyof typeof data.integrations]}
                        onChange={(e) =>
                          updateData({
                            integrations: { ...data.integrations, [service.id]: e.target.checked },
                          })
                        }
                        className="w-5 h-5 text-indigo-600 rounded"
                      />
                      <span className="ml-3 text-2xl">{service.icon}</span>
                      <span className="ml-2 font-medium text-gray-900 dark:text-white">{service.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">You're All Set!</h2>
            <p className="text-lg text-gray-600 dark:text-gray-300 mb-8">
              VibeCode is configured and ready to use
            </p>
            <button
              onClick={completeOnboarding}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Start Coding
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
