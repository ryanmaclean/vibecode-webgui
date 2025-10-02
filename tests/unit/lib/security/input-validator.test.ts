/**
 * Unit Tests for Input Validator Module
 * Tests input validation, sanitization, rate limiting, and security logging
 */

import { jest } from '@jest/globals'
import * as validator from '@/lib/security/input-validator'

// Define SpyInstance type directly since it's not properly exported
type SpyInstance = jest.SpiedFunction<any>

describe('Input Validator Module', () => {
  let consoleSpy: SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
