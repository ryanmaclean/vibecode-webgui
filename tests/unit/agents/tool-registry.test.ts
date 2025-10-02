/**
 * Unit tests for Tool Registry
 * Tests tool registration, execution, and metrics
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ToolRegistry, registerBuiltInTools } from '@/lib/agents/tool-registry'
import type { ToolCall } from '@/types/openai-agents'

describe('ToolRegistry', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  describe('Tool Registration', () => {
    it('registers a tool successfully', () => {
      registry.register(
        'test_tool',
        {
          description: 'A test tool',
          parameters: {
            type: 'object',
            properties: {
              input: { type: 'string' },
            },
            required: ['input'],
          },
        },
        async (args) => ({ result: args.input }),
        {
          category: 'test',
          tags: ['testing'],
        }
      )

      expect(registry.has('test_tool')).toBe(true)
      const tool = registry.get('test_tool')
      expect(tool?.definition.function.name).toBe('test_tool')
      expect(tool?.definition.function.description).toBe('A test tool')
    })

    it('overwrites existing tool on re-registration', () => {
      registry.register(
        'duplicate',
        { description: 'First', parameters: {} },
        async () => ({ version: 1 })
      )

      registry.register(
        'duplicate',
        { description: 'Second', parameters: {} },
        async () => ({ version: 2 })
      )

      const tool = registry.get('duplicate')
      expect(tool?.definition.function.description).toBe('Second')
    })

    it('unregisters a tool', () => {
      registry.register(
        'temp_tool',
        { description: 'Temporary', parameters: {} },
        async () => ({})
      )

      expect(registry.has('temp_tool')).toBe(true)

      const removed = registry.unregister('temp_tool')
      expect(removed).toBe(true)
      expect(registry.has('temp_tool')).toBe(false)
    })

    it('returns false when unregistering non-existent tool', () => {
      const removed = registry.unregister('does_not_exist')
      expect(removed).toBe(false)
    })
  })

  describe('Tool Execution', () => {
    it('executes a tool successfully', async () => {
      registry.register(
        'add_numbers',
        {
          description: 'Add two numbers',
          parameters: {
            type: 'object',
            properties: {
              a: { type: 'number' },
              b: { type: 'number' },
            },
            required: ['a', 'b'],
          },
        },
        async (args) => ({
          result: (args.a as number) + (args.b as number),
        })
      )

      const toolCall: ToolCall = {
        id: 'call_123',
        type: 'function',
        function: {
          name: 'add_numbers',
          arguments: JSON.stringify({ a: 5, b: 3 }),
        },
      }

      const output = await registry.execute(toolCall)

      expect(output.tool_call_id).toBe('call_123')
      expect(JSON.parse(output.output)).toEqual({ result: 8 })
    })

    it('handles tool execution errors gracefully', async () => {
      registry.register(
        'failing_tool',
        {
          description: 'A tool that fails',
          parameters: {},
        },
        async () => {
          throw new Error('Tool execution failed')
        }
      )

      const toolCall: ToolCall = {
        id: 'call_456',
        type: 'function',
        function: {
          name: 'failing_tool',
          arguments: '{}',
        },
      }

      const output = await registry.execute(toolCall)

      expect(output.tool_call_id).toBe('call_456')
      const parsed = JSON.parse(output.output)
      expect(parsed.error).toBe('Tool execution failed')
    })

    it('returns error for non-existent tool', async () => {
      const toolCall: ToolCall = {
        id: 'call_789',
        type: 'function',
        function: {
          name: 'does_not_exist',
          arguments: '{}',
        },
      }

      const output = await registry.execute(toolCall)

      const parsed = JSON.parse(output.output)
      expect(parsed.error).toContain('not found')
    })

    it('returns error for invalid arguments', async () => {
      registry.register(
        'valid_tool',
        {
          description: 'Valid tool',
          parameters: {},
        },
        async () => ({ success: true })
      )

      const toolCall: ToolCall = {
        id: 'call_invalid',
        type: 'function',
        function: {
          name: 'valid_tool',
          arguments: 'not valid json',
        },
      }

      const output = await registry.execute(toolCall)

      const parsed = JSON.parse(output.output)
      expect(parsed.error).toContain('Invalid arguments')
    })

    it('executes multiple tools in batch', async () => {
      registry.register(
        'multiply',
        {
          description: 'Multiply two numbers',
          parameters: {},
        },
        async (args) => ({
          result: (args.a as number) * (args.b as number),
        })
      )

      const toolCalls: ToolCall[] = [
        {
          id: 'call_1',
          type: 'function',
          function: {
            name: 'multiply',
            arguments: JSON.stringify({ a: 2, b: 3 }),
          },
        },
        {
          id: 'call_2',
          type: 'function',
          function: {
            name: 'multiply',
            arguments: JSON.stringify({ a: 4, b: 5 }),
          },
        },
      ]

      const outputs = await registry.executeBatch(toolCalls)

      expect(outputs).toHaveLength(2)
      expect(JSON.parse(outputs[0].output)).toEqual({ result: 6 })
      expect(JSON.parse(outputs[1].output)).toEqual({ result: 20 })
    })
  })

  describe('Rate Limiting', () => {
    it('enforces rate limits', async () => {
      registry.register(
        'limited_tool',
        {
          description: 'Rate limited tool',
          parameters: {},
        },
        async () => ({ success: true }),
        {
          rateLimit: {
            maxCalls: 2,
            windowMs: 1000,
          },
        }
      )

      const createCall = (id: string): ToolCall => ({
        id,
        type: 'function',
        function: {
          name: 'limited_tool',
          arguments: '{}',
        },
      })

      // First two calls should succeed
      const output1 = await registry.execute(createCall('call_1'))
      const output2 = await registry.execute(createCall('call_2'))

      expect(JSON.parse(output1.output).success).toBe(true)
      expect(JSON.parse(output2.output).success).toBe(true)

      // Third call should be rate limited
      const output3 = await registry.execute(createCall('call_3'))
      const parsed = JSON.parse(output3.output)
      expect(parsed.error).toContain('Rate limit')
    })
  })

  describe('Metrics', () => {
    it('tracks execution metrics', async () => {
      registry.register(
        'metric_tool',
        {
          description: 'Tool with metrics',
          parameters: {},
        },
        async () => ({ success: true })
      )

      const toolCall: ToolCall = {
        id: 'call_metrics',
        type: 'function',
        function: {
          name: 'metric_tool',
          arguments: '{}',
        },
      }

      await registry.execute(toolCall)
      await registry.execute(toolCall)

      const metrics = registry.getMetrics('metric_tool')

      expect(metrics?.totalCalls).toBe(2)
      expect(metrics?.successfulCalls).toBe(2)
      expect(metrics?.failedCalls).toBe(0)
      expect(metrics?.successRate).toBe(1)
    })

    it('tracks failed executions in metrics', async () => {
      registry.register(
        'failing_metric_tool',
        {
          description: 'Tool that fails',
          parameters: {},
        },
        async () => {
          throw new Error('Intentional failure')
        }
      )

      const toolCall: ToolCall = {
        id: 'call_fail',
        type: 'function',
        function: {
          name: 'failing_metric_tool',
          arguments: '{}',
        },
      }

      await registry.execute(toolCall)

      const metrics = registry.getMetrics('failing_metric_tool')

      expect(metrics?.totalCalls).toBe(1)
      expect(metrics?.successfulCalls).toBe(0)
      expect(metrics?.failedCalls).toBe(1)
      expect(metrics?.successRate).toBe(0)
      expect(metrics?.lastError).toBe('Intentional failure')
    })

    it('resets metrics for a tool', () => {
      registry.register(
        'reset_tool',
        { description: 'Tool to reset', parameters: {} },
        async () => ({})
      )

      const toolCall: ToolCall = {
        id: 'call_reset',
        type: 'function',
        function: {
          name: 'reset_tool',
          arguments: '{}',
        },
      }

      registry.execute(toolCall)

      registry.resetMetrics('reset_tool')

      const metrics = registry.getMetrics('reset_tool')
      expect(metrics?.totalCalls).toBe(0)
    })

    it('gets metrics for all tools', async () => {
      registry.register(
        'tool_1',
        { description: 'First', parameters: {} },
        async () => ({})
      )
      registry.register(
        'tool_2',
        { description: 'Second', parameters: {} },
        async () => ({})
      )

      const allMetrics = registry.getAllMetrics()

      expect(Object.keys(allMetrics)).toContain('tool_1')
      expect(Object.keys(allMetrics)).toContain('tool_2')
    })
  })

  describe('Tool Discovery', () => {
    it('gets all tool definitions', () => {
      registry.register(
        'tool_a',
        { description: 'A', parameters: {} },
        async () => ({}),
        { category: 'test', tags: ['a'] }
      )
      registry.register(
        'tool_b',
        { description: 'B', parameters: {} },
        async () => ({}),
        { category: 'test', tags: ['b'] }
      )

      const definitions = registry.getDefinitions()

      expect(definitions).toHaveLength(2)
      expect(definitions[0].function.name).toBe('tool_a')
      expect(definitions[1].function.name).toBe('tool_b')
    })

    it('filters tools by category', () => {
      registry.register(
        'cat1_tool',
        { description: 'Category 1', parameters: {} },
        async () => ({}),
        { category: 'category1' }
      )
      registry.register(
        'cat2_tool',
        { description: 'Category 2', parameters: {} },
        async () => ({}),
        { category: 'category2' }
      )

      const filtered = registry.getDefinitions({ category: 'category1' })

      expect(filtered).toHaveLength(1)
      expect(filtered[0].function.name).toBe('cat1_tool')
    })

    it('filters tools by tags', () => {
      registry.register(
        'tagged_tool',
        { description: 'Tagged', parameters: {} },
        async () => ({}),
        { tags: ['tag1', 'tag2'] }
      )
      registry.register(
        'other_tool',
        { description: 'Other', parameters: {} },
        async () => ({}),
        { tags: ['tag3'] }
      )

      const filtered = registry.getDefinitions({ tags: ['tag1'] })

      expect(filtered).toHaveLength(1)
      expect(filtered[0].function.name).toBe('tagged_tool')
    })

    it('lists all tools with metadata', () => {
      registry.register(
        'listed_tool',
        { description: 'Listed', parameters: {} },
        async () => ({}),
        { category: 'list', tags: ['listed'] }
      )

      const list = registry.list()

      expect(list).toHaveLength(1)
      expect(list[0].name).toBe('listed_tool')
      expect(list[0].category).toBe('list')
      expect(list[0].tags).toContain('listed')
    })
  })

  describe('Built-in Tools', () => {
    it('registers built-in tools', () => {
      registerBuiltInTools(registry)

      expect(registry.has('read_file')).toBe(true)
      expect(registry.has('execute_code')).toBe(true)
      expect(registry.has('search_workspace')).toBe(true)
      expect(registry.has('run_terminal_command')).toBe(true)
    })
  })

  describe('Cleanup', () => {
    it('clears all tools', () => {
      registry.register(
        'tool1',
        { description: 'Tool 1', parameters: {} },
        async () => ({})
      )
      registry.register(
        'tool2',
        { description: 'Tool 2', parameters: {} },
        async () => ({})
      )

      expect(registry.list()).toHaveLength(2)

      registry.clear()

      expect(registry.list()).toHaveLength(0)
    })
  })
})
