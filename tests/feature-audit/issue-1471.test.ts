import { registerMonacoAgentProviders } from '@/lib/editor/monaco-agentapi'

describe('feature audit #1471: IntelliSense completion provider', () => {
  it('registers a completion provider with trigger characters', () => {
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

    registerMonacoAgentProviders(monacoInstance, 'typescript', agentAPI)

    expect(registerCompletionItemProvider).toHaveBeenCalledTimes(1)
    const [, provider] = registerCompletionItemProvider.mock.calls[0]
    expect(provider.triggerCharacters).toEqual(expect.arrayContaining(['.', ':']))
  })
})
