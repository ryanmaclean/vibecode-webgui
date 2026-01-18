'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import type {
  AiProvider,
  CliEditorOption,
  IdeOption,
  ThemeOption,
  UserPreferences,
} from '@/lib/user-preferences'
import {
  defaultUserPreferences,
  mergeWithDefaultPreferences,
} from '@/lib/user-preferences'
import { useUserPreferences } from '@/providers/UserPreferencesProvider'

type OnboardingStep =
  | 'welcome'
  | 'theme'
  | 'workspace'
  | 'editor'
  | 'extensions'
  | 'integrations'
  | 'ai'
  | 'complete'

type OnboardingData = UserPreferences

const steps: OnboardingStep[] = [
  'welcome',
  'theme',
  'workspace',
  'editor',
  'extensions',
  'integrations',
  'ai',
  'complete',
]

const stepLabels: Record<Exclude<OnboardingStep, 'complete'>, string> = {
  welcome: 'Welcome',
  theme: 'Theme',
  workspace: 'Workspace',
  editor: 'Editor',
  extensions: 'Extensions',
  integrations: 'Integrations',
  ai: 'AI',
}

const extensionCatalog: { id: string; name: string; description: string }[] = [
  { id: 'prettier', name: 'Prettier', description: 'Automated code formatting for JS/TS.' },
  { id: 'eslint', name: 'ESLint', description: 'Surface lint issues inline with fixes.' },
  { id: 'tailwind-intellisense', name: 'Tailwind IntelliSense', description: 'Autocomplete & docs for Tailwind classes.' },
  { id: 'datadog', name: 'Datadog CI', description: 'Link traces, logs, and test runs inside the editor.' },
  { id: 'gitlens', name: 'GitLens', description: 'Understand authorship, history, and PR context quickly.' },
  { id: 'docker', name: 'Docker', description: 'Manage containers and Compose right from the IDE.' },
]

const extensionBundles = [
  {
    id: 'nextjs',
    name: 'Next.js Essentials',
    items: ['prettier', 'eslint', 'tailwind-intellisense'],
    description: 'Formatting, linting, and Tailwind tooling tuned for this repo.',
  },
  {
    id: 'testing',
    name: 'Testing & QA',
    items: ['jest-runner', 'testing-library', 'axe'],
    description: 'Ship confidently with unit, integration, and accessibility helpers.',
  },
  {
    id: 'observability',
    name: 'Observability',
    items: ['datadog', 'open-telemetry', 'eslint-security'],
    description: 'Keep runtime, security, and pipeline signals close at hand.',
  },
]

const integrationCategories: {
  title: string
  options: { id: keyof OnboardingData['integrations']; name: string; description: string }[]
}[] = [
  {
    title: 'Source Control',
    options: [
      { id: 'github', name: 'GitHub', description: 'Code hosting, PR reviews, and Actions.' },
      { id: 'gitlab', name: 'GitLab', description: 'Self-hosted or SaaS CI/CD pipelines.' },
    ],
  },
  {
    title: 'Planning',
    options: [
      { id: 'jira', name: 'Jira', description: 'Classic agile workflows with releases & reports.' },
      { id: 'linear', name: 'Linear', description: 'Fast, keyboard-first issue tracking.' },
    ],
  },
  {
    title: 'Observability',
    options: [
      { id: 'datadog', name: 'Datadog', description: 'Traces, logs, synthetics, and RUM dashboards.' },
      { id: 'sentry', name: 'Sentry', description: 'Error tracking and performance budgets.' },
    ],
  },
]

const aiProviderOptions: { id: AiProvider; label: string; description: string }[] = [
  { id: 'openai', label: 'OpenAI', description: 'GPT-4o & o1 models via org gateway.' },
  { id: 'anthropic', label: 'Anthropic', description: 'Claude 3.5 Sonnet for analysis & code review.' },
  { id: 'gemini', label: 'Google Gemini', description: 'Gemini 1.5 Pro for multimodal use cases.' },
  { id: 'claude', label: 'Claude Desktop', description: 'Claude with Windsurf + MCP workflows.' },
  { id: 'groq', label: 'Groq', description: 'Lightning-fast LPU inference for automations.' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState<OnboardingStep>('welcome')
  const {
    preferences: storedPreferences,
    isLoading: preferencesLoading,
    error: preferencesError,
    save: savePreferences,
  } = useUserPreferences()
  const [data, setData] = useState<OnboardingData>({ ...defaultUserPreferences })
  const [localError, setLocalError] = useState<string | null>(null)
  const error = localError ?? preferencesError ?? null

  const updateData = (updates: Partial<OnboardingData>) => {
    setLocalError(null)
    setData((prev) =>
      mergeWithDefaultPreferences({
        ...prev,
        ...updates,
      }),
    )
  }

  const toggleExtension = (extensionId: string) => {
    setLocalError(null)
    setData((prev) =>
      mergeWithDefaultPreferences({
        ...prev,
        extensions: prev.extensions.includes(extensionId)
          ? prev.extensions.filter((item) => item !== extensionId)
          : [...prev.extensions, extensionId],
      }),
    )
  }

  const toggleIntegration = (id: keyof OnboardingData['integrations']) => {
    setLocalError(null)
    setData((prev) =>
      mergeWithDefaultPreferences({
        ...prev,
        integrations: {
          ...prev.integrations,
          [id]: !prev.integrations[id],
        },
      }),
    )
  }

  const toggleAiProvider = (provider: AiProvider) => {
    setLocalError(null)
    setData((prev) =>
      mergeWithDefaultPreferences({
        ...prev,
        aiProviders: prev.aiProviders.includes(provider)
          ? prev.aiProviders.filter((item) => item !== provider)
          : [...prev.aiProviders, provider],
      }),
    )
  }

  const nextStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1])
    }
  }

  const prevStep = () => {
    const currentIndex = steps.indexOf(step)
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1])
    }
  }

  const completeOnboarding = async () => {
    try {
      await savePreferences({
        theme: data.theme,
        cliEditor: data.cliEditor,
        preferredIde: data.preferredIde,
        extensions: data.extensions,
        integrations: data.integrations,
        aiProviders: data.aiProviders,
      })
      router.push('/dashboard')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We hit a snag saving your preferences. Please try again.'
      setLocalError(message)
    }
  }

  const progressPercent = (steps.indexOf(step) / (steps.length - 1)) * 100

  useEffect(() => {
    const merged = mergeWithDefaultPreferences(storedPreferences)
    setData(merged)
    if (merged.onboardingCompleted) {
      setStep('complete')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-3xl w-full p-8 space-y-8">
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1 mb-3 text-center">
            {(steps.filter((s) => s !== 'complete') as Exclude<OnboardingStep, 'complete'>[]).map((s) => (
              <span
                key={s}
                className={`text-xs ${
                  steps.indexOf(s) <= steps.indexOf(step)
                    ? 'text-indigo-600 dark:text-indigo-400 font-semibold'
                    : 'text-gray-400'
                }`}
              >
                {stepLabels[s]}
              </span>
            ))}
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-indigo-600 dark:bg-indigo-500 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {preferencesLoading && (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 text-center">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading your saved preferences…</p>
          </div>
        )}

        {!preferencesLoading && error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200">
            {error}
          </div>
        )}

        {!preferencesLoading && step === 'welcome' && (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Welcome to VibeCode 🚀</h1>
            <p className="text-lg text-gray-600 dark:text-gray-300">
              Let&apos;s tailor your workspace, IDE, and automations in under two minutes.
            </p>
            <button
              onClick={nextStep}
              className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
            >
              Get Started
            </button>
          </div>
        )}

        {!preferencesLoading && step === 'theme' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Choose Your Theme</h2>
              <p className="text-gray-600 dark:text-gray-300">Pick what&apos;s easiest on your eyes.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { value: 'light' as ThemeOption, label: 'Light', emoji: '☀️' },
                { value: 'dark' as ThemeOption, label: 'Dark', emoji: '🌙' },
                { value: 'auto' as ThemeOption, label: 'Auto', emoji: '🔄' },
              ].map((theme) => (
                <button
                  key={theme.value}
                  onClick={() => updateData({ theme: theme.value })}
                  className={`p-6 rounded-lg border-2 transition-all ${
                    data.theme === theme.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="text-4xl mb-3">{theme.emoji}</div>
                  <div className="font-semibold text-gray-900 dark:text-white">{theme.label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {theme.value === 'auto' ? 'Sync with system preference' : 'Great for focus.'}
                  </div>
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

        {!preferencesLoading && step === 'workspace' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Where will you build?</h2>
              <p className="text-gray-600 dark:text-gray-300">
                We&apos;ll preload recommended extensions and settings for your primary workspace.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  value: 'vs-code' as IdeOption,
                  label: 'VS Code Desktop',
                  description: 'Sync settings, extensions, and Remote Containers.',
                },
                {
                  value: 'windsurf' as IdeOption,
                  label: 'Windsurf',
                  description: 'Claude-ready environment with MCP support and agent workflows.',
                },
                {
                  value: 'code-server' as IdeOption,
                  label: 'Code-server (KinD)',
                  description: 'Browser IDE co-located with the KinD cluster for demos.',
                },
                {
                  value: 'browser-only' as IdeOption,
                  label: 'Browser Only',
                  description: 'Stay inside the VibeCode GUI with live previews.',
                },
              ].map((workspace) => (
                <button
                  key={workspace.value}
                  onClick={() => updateData({ preferredIde: workspace.value })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.preferredIde === workspace.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">{workspace.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{workspace.description}</div>
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

        {!preferencesLoading && step === 'editor' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">CLI Editor Preference</h2>
              <p className="text-gray-600 dark:text-gray-300">We&apos;ll preinstall and configure it in dev containers.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { value: 'vim' as CliEditorOption, label: 'Vim', description: 'Classic modal editing.' },
                { value: 'neovim' as CliEditorOption, label: 'Neovim', description: 'Modern Vim with Lua plugins.' },
                { value: 'nano' as CliEditorOption, label: 'Nano', description: 'Simple and friendly.' },
                { value: 'none' as CliEditorOption, label: 'Skip', description: 'I will stay in the browser IDE.' },
              ].map((editor) => (
                <button
                  key={editor.value}
                  onClick={() => updateData({ cliEditor: editor.value })}
                  className={`p-4 rounded-lg border-2 text-left transition-all ${
                    data.cliEditor === editor.value
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <div className="font-semibold text-gray-900 dark:text-white mb-1">{editor.label}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">{editor.description}</div>
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

        {!preferencesLoading && step === 'extensions' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Recommended Extensions</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Apply a preset or cherry-pick individual tools for your workspace.
              </p>
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                {extensionBundles.map((bundle) => (
                  <button
                    key={bundle.id}
                    type="button"
                    onClick={() => bundle.items.forEach((item) => toggleExtension(item))}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-4 p-4 border-2 rounded-lg transition-all hover:border-indigo-300">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                          {bundle.name}
                          <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                            {bundle.items.length} tools
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{bundle.description}</div>
                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 dark:text-gray-400">
                          {bundle.items.map((item) => (
                            <span
                              key={item}
                              className={`px-2 py-1 rounded-full border ${
                                data.extensions.includes(item) ? 'border-indigo-500 text-indigo-600' : 'border-gray-300'
                              }`}
                            >
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        readOnly
                        checked={bundle.items.every((item) => data.extensions.includes(item))}
                        className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                    </div>
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {extensionCatalog.map((extension) => (
                  <label
                    key={extension.id}
                    className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-all ${
                      data.extensions.includes(extension.id)
                        ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={data.extensions.includes(extension.id)}
                      onChange={() => toggleExtension(extension.id)}
                      className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{extension.name}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">{extension.description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tip: You can always adjust these later under Settings → Workspace → Editor Integrations.
              </p>
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

        {!preferencesLoading && step === 'integrations' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Connect Your Tools</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Link source control, planning, and observability so dashboards light up instantly.
              </p>
            </div>
            <div className="space-y-5">
              {integrationCategories.map((category) => (
                <div key={category.title} className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">{category.title}</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {category.options.map((integration) => (
                      <label
                        key={integration.id}
                        className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-all ${
                          data.integrations[integration.id]
                            ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(data.integrations[integration.id])}
                          onChange={() => toggleIntegration(integration.id)}
                          className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{integration.name}</div>
                          <div className="text-sm text-gray-600 dark:text-gray-400">{integration.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
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

        {!preferencesLoading && step === 'ai' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">AI Providers</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Choose the AI assistants you rely on—VibeCode will configure keys and routing for you.
              </p>
            </div>
            <div className="space-y-3">
              {aiProviderOptions.map((provider) => (
                <label
                  key={provider.id}
                  className={`flex items-start gap-3 p-4 border-2 rounded-lg transition-all ${
                    data.aiProviders.includes(provider.id)
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-indigo-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={data.aiProviders.includes(provider.id)}
                    onChange={() => toggleAiProvider(provider.id)}
                    className="mt-1 h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <div>
                    <div className="font-semibold text-gray-900 dark:text-white">{provider.label}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">{provider.description}</div>
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

        {!preferencesLoading && step === 'complete' && (
          <div className="text-center space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white">You&apos;re all set 🎉</h2>
              <p className="text-gray-600 dark:text-gray-300">
                Summary of what we&apos;ll configure for you. You can tweak any setting later.
              </p>
            </div>
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-6 text-left space-y-3">
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Theme:</span> {data.theme}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Workspace:</span> {data.preferredIde}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">CLI Editor:</span> {data.cliEditor}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Extensions:</span>{' '}
                {data.extensions.length > 0 ? data.extensions.join(', ') : 'Skip for now'}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">Integrations:</span>{' '}
                {Object.entries(data.integrations)
                  .filter(([, enabled]) => enabled)
                  .map(([name]) => name)
                  .join(', ') || 'None yet'}
              </div>
              <div>
                <span className="font-semibold text-gray-900 dark:text-white">AI Providers:</span>{' '}
                {data.aiProviders.join(', ')}
              </div>
            </div>
            <div className="flex justify-between">
              <button onClick={prevStep} className="px-6 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900">
                Back
              </button>
              <button
                onClick={completeOnboarding}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold"
              >
                Launch Workspace
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
