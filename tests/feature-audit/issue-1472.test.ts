import { DEFAULT_EDITOR_LANGUAGE } from '@/components/editor/AgentMonacoEditor'
import { registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'

describe('feature audit #1472: Syntax highlighting language wiring', () => {
  it('exports a default language and registers providers for it', () => {
    const registerCompletionItemProvider = jest.fn(() => ({ dispose: jest.fn() }))
    const registerHoverProvider = jest.fn(() => ({ dispose: jest.fn() }))
    const registerCodeActionProvider = jest.fn(() => ({ dispose: jest.fn() }))

    const monacoInstance = {
      languages: {
        registerCompletionItemProvider,
        registerHoverProvider,
        registerCodeActionProvider,
      },
    } as unknown as typeof import('monaco-editor')

    const agentAPI = {
      requestCompletions: jest.fn(async () => []),
      requestHover: jest.fn(async () => null),
      requestCodeActions: jest.fn(async () => []),
    } as unknown as import('@/lib/editor/monaco-agentapi').MonacoAgentAPI

    registerMonacoAgentProviders(monacoInstance, DEFAULT_EDITOR_LANGUAGE, agentAPI)

    expect(DEFAULT_EDITOR_LANGUAGE).toBe('typescript')
    expect(registerCompletionItemProvider).toHaveBeenCalledWith(
      DEFAULT_EDITOR_LANGUAGE,
      expect.any(Object)
    )
  })
})
