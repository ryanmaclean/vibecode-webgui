/**
 * Tests for demo prompts data
 */

import { DEMO_PROMPTS, DemoPrompt } from '../../../src/data/demo-prompts'

describe('DEMO_PROMPTS', () => {
  describe('data structure', () => {
    it('should export an array of demo prompts', () => {
      expect(Array.isArray(DEMO_PROMPTS)).toBe(true)
      expect(DEMO_PROMPTS.length).toBeGreaterThan(0)
    })

    it('should have at least 3 demo prompts', () => {
      expect(DEMO_PROMPTS.length).toBeGreaterThanOrEqual(3)
    })

    it('should have all prompts with required fields', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt).toHaveProperty('id')
        expect(prompt).toHaveProperty('title')
        expect(prompt).toHaveProperty('description')
        expect(prompt).toHaveProperty('useCase')
        expect(prompt).toHaveProperty('prompt')
      })
    })
  })

  describe('field validation', () => {
    it('should have unique IDs', () => {
      const ids = DEMO_PROMPTS.map(p => p.id)
      const uniqueIds = new Set(ids)

      expect(ids.length).toBe(uniqueIds.size)
    })

    it('should have non-empty IDs', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.id).toBeTruthy()
        expect(prompt.id.length).toBeGreaterThan(0)
      })
    })

    it('should have non-empty titles', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.title).toBeTruthy()
        expect(prompt.title.length).toBeGreaterThan(0)
      })
    })

    it('should have non-empty descriptions', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.description).toBeTruthy()
        expect(prompt.description.length).toBeGreaterThan(0)
      })
    })

    it('should have non-empty use cases', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.useCase).toBeTruthy()
        expect(prompt.useCase.length).toBeGreaterThan(0)
      })
    })

    it('should have non-empty prompts', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.prompt).toBeTruthy()
        expect(prompt.prompt.length).toBeGreaterThan(0)
      })
    })

    it('should have valid ID format (kebab-case)', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/)
      })
    })
  })

  describe('specific prompts', () => {
    it('should include lovable-app-sprint-plan prompt', () => {
      const sprintPrompt = DEMO_PROMPTS.find(p => p.id === 'lovable-app-sprint-plan')

      expect(sprintPrompt).toBeDefined()
      expect(sprintPrompt?.title).toContain('Lovable')
      expect(sprintPrompt?.title).toContain('Sprint')
      expect(sprintPrompt?.useCase).toBe('Product Planning')
    })

    it('should include rag-debugging-session prompt', () => {
      const ragPrompt = DEMO_PROMPTS.find(p => p.id === 'rag-debugging-session')

      expect(ragPrompt).toBeDefined()
      expect(ragPrompt?.title).toContain('RAG')
      expect(ragPrompt?.title).toContain('Debugging')
      expect(ragPrompt?.useCase).toBe('Operational Runbook')
    })

    it('should include demo-script prompt', () => {
      const demoPrompt = DEMO_PROMPTS.find(p => p.id === 'demo-script')

      expect(demoPrompt).toBeDefined()
      expect(demoPrompt?.title).toContain('Demo')
      expect(demoPrompt?.useCase).toBe('Presentations')
    })
  })

  describe('prompt content validation', () => {
    it('should have prompts with reasonable length', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.prompt.length).toBeGreaterThan(50)
        expect(prompt.prompt.length).toBeLessThan(5000)
      })
    })

    it('should have descriptions with reasonable length', () => {
      DEMO_PROMPTS.forEach(prompt => {
        expect(prompt.description.length).toBeGreaterThan(10)
        expect(prompt.description.length).toBeLessThan(500)
      })
    })

    it('should have contextExamples as array or undefined', () => {
      DEMO_PROMPTS.forEach(prompt => {
        if (prompt.contextExamples !== undefined) {
          expect(Array.isArray(prompt.contextExamples)).toBe(true)
        }
      })
    })

    it('should have non-empty contextExamples when present', () => {
      DEMO_PROMPTS.forEach(prompt => {
        if (prompt.contextExamples) {
          expect(prompt.contextExamples.length).toBeGreaterThan(0)
          prompt.contextExamples.forEach(example => {
            expect(example).toBeTruthy()
            expect(example.length).toBeGreaterThan(0)
          })
        }
      })
    })
  })

  describe('use case categorization', () => {
    it('should have defined use case categories', () => {
      const useCases = DEMO_PROMPTS.map(p => p.useCase)
      const uniqueUseCases = new Set(useCases)

      expect(uniqueUseCases.size).toBeGreaterThan(0)
      expect(uniqueUseCases.size).toBeLessThanOrEqual(DEMO_PROMPTS.length)
    })

    it('should have Product Planning use case', () => {
      const hasProductPlanning = DEMO_PROMPTS.some(p => p.useCase === 'Product Planning')
      expect(hasProductPlanning).toBe(true)
    })

    it('should have Operational Runbook use case', () => {
      const hasOperational = DEMO_PROMPTS.some(p => p.useCase === 'Operational Runbook')
      expect(hasOperational).toBe(true)
    })

    it('should have Presentations use case', () => {
      const hasPresentations = DEMO_PROMPTS.some(p => p.useCase === 'Presentations')
      expect(hasPresentations).toBe(true)
    })
  })

  describe('content quality', () => {
    it('should have prompts with clear instructions', () => {
      DEMO_PROMPTS.forEach(prompt => {
        const hasVerbs = /\b(create|plan|guide|produce|act|outline|return)\b/i.test(prompt.prompt)
        expect(hasVerbs).toBe(true)
      })
    })

    it('should mention Azure in relevant prompts', () => {
      const azurePrompts = DEMO_PROMPTS.filter(p => p.prompt.toLowerCase().includes('azure'))
      expect(azurePrompts.length).toBeGreaterThan(0)
    })

    it('should mention Datadog in relevant prompts', () => {
      const datadogPrompts = DEMO_PROMPTS.filter(p => p.prompt.toLowerCase().includes('datadog'))
      expect(datadogPrompts.length).toBeGreaterThan(0)
    })

    it('should mention Lovable in relevant prompts', () => {
      const lovablePrompts = DEMO_PROMPTS.filter(p => p.prompt.toLowerCase().includes('lovable'))
      expect(lovablePrompts.length).toBeGreaterThan(0)
    })
  })

  describe('TypeScript type checking', () => {
    it('should match DemoPrompt interface', () => {
      DEMO_PROMPTS.forEach(prompt => {
        const typed: DemoPrompt = prompt
        expect(typed.id).toBe(prompt.id)
        expect(typed.title).toBe(prompt.title)
        expect(typed.description).toBe(prompt.description)
        expect(typed.useCase).toBe(prompt.useCase)
        expect(typed.prompt).toBe(prompt.prompt)
      })
    })
  })

  describe('searchability', () => {
    it('should be findable by ID', () => {
      const id = 'lovable-app-sprint-plan'
      const found = DEMO_PROMPTS.find(p => p.id === id)

      expect(found).toBeDefined()
      expect(found?.id).toBe(id)
    })

    it('should be filterable by use case', () => {
      const productPrompts = DEMO_PROMPTS.filter(p => p.useCase === 'Product Planning')
      expect(productPrompts.length).toBeGreaterThan(0)
    })

    it('should be searchable by title keywords', () => {
      const sprintPrompts = DEMO_PROMPTS.filter(p =>
        p.title.toLowerCase().includes('sprint')
      )
      expect(sprintPrompts.length).toBeGreaterThan(0)
    })
  })
})
