/**
 * Tests for Guardrail Templates
 */

import { describe, it, expect } from '@jest/globals';
import {
  GUARDRAIL_TEMPLATES,
  GUARDRAIL_PRESETS,
  createGuardrail,
  getTemplate,
  getPreset
} from '../../../../src/lib/experiments/guardrail-templates';

describe('Guardrail Templates', () => {
  describe('Error Rate Guardrails', () => {
    it('should create maxErrorRate guardrail with default threshold', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxErrorRate();
      expect(guardrail.metricName).toBe('error_rate');
      expect(guardrail.operator).toBe('<');
      expect(guardrail.threshold).toBe(0.01);
      expect(guardrail.severity).toBe('critical');
    });

    it('should create maxErrorRate guardrail with custom threshold', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxErrorRate(0.05);
      expect(guardrail.threshold).toBe(0.05);
      expect(guardrail.description).toContain('5.0%');
    });

    it('should create maxErrorCount guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxErrorCount(50);
      expect(guardrail.metricName).toBe('error_count');
      expect(guardrail.threshold).toBe(50);
      expect(guardrail.description).toContain('50');
    });

    it('should create max5xxRate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.max5xxRate(0.002);
      expect(guardrail.metricName).toBe('error_5xx_rate');
      expect(guardrail.threshold).toBe(0.002);
    });
  });

  describe('Latency Guardrails', () => {
    it('should create maxP50Latency guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxP50Latency(1000);
      expect(guardrail.metricName).toBe('latency_p50');
      expect(guardrail.threshold).toBe(1000);
      expect(guardrail.severity).toBe('warning');
    });

    it('should create maxP95Latency guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxP95Latency(3000);
      expect(guardrail.metricName).toBe('latency_p95');
      expect(guardrail.threshold).toBe(3000);
      expect(guardrail.severity).toBe('critical');
    });

    it('should create maxP99Latency guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxP99Latency(8000);
      expect(guardrail.metricName).toBe('latency_p99');
      expect(guardrail.threshold).toBe(8000);
    });

    it('should create maxAvgLatency guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxAvgLatency(2500);
      expect(guardrail.metricName).toBe('latency_avg');
      expect(guardrail.threshold).toBe(2500);
    });
  });

  describe('Cost Guardrails', () => {
    it('should create maxCostPerRequest guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxCostPerRequest(0.10);
      expect(guardrail.metricName).toBe('cost_per_request');
      expect(guardrail.threshold).toBe(0.10);
      expect(guardrail.description).toContain('$0.10');
    });

    it('should create maxTotalCost guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxTotalCost(5000);
      expect(guardrail.metricName).toBe('total_cost');
      expect(guardrail.threshold).toBe(5000);
      expect(guardrail.severity).toBe('critical');
    });

    it('should create maxHourlyCost guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxHourlyCost(200);
      expect(guardrail.metricName).toBe('cost_per_hour');
      expect(guardrail.threshold).toBe(200);
    });
  });

  describe('Quality Guardrails', () => {
    it('should create minUserSatisfaction guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minUserSatisfaction(4.5);
      expect(guardrail.metricName).toBe('user_satisfaction');
      expect(guardrail.operator).toBe('>');
      expect(guardrail.threshold).toBe(4.5);
    });

    it('should create minNPS guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minNPS(60);
      expect(guardrail.metricName).toBe('nps_score');
      expect(guardrail.threshold).toBe(60);
    });

    it('should create minQualityScore guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minQualityScore(0.8);
      expect(guardrail.metricName).toBe('quality_score');
      expect(guardrail.threshold).toBe(0.8);
    });

    it('should create maxWordErrorRate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxWordErrorRate(0.03);
      expect(guardrail.metricName).toBe('word_error_rate');
      expect(guardrail.threshold).toBe(0.03);
    });
  });

  describe('Conversion Guardrails', () => {
    it('should create minConversionRate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minConversionRate(0.15);
      expect(guardrail.metricName).toBe('conversion_rate');
      expect(guardrail.threshold).toBe(0.15);
      expect(guardrail.description).toContain('15.0%');
    });

    it('should create minRevenuePerUser guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minRevenuePerUser(10.0);
      expect(guardrail.metricName).toBe('revenue_per_user');
      expect(guardrail.threshold).toBe(10.0);
    });

    it('should create maxCartAbandonment guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxCartAbandonment(0.6);
      expect(guardrail.metricName).toBe('cart_abandonment_rate');
      expect(guardrail.threshold).toBe(0.6);
    });
  });

  describe('Engagement Guardrails', () => {
    it('should create minSessionDuration guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minSessionDuration(180);
      expect(guardrail.metricName).toBe('session_duration_avg');
      expect(guardrail.threshold).toBe(180);
    });

    it('should create minMessagesPerSession guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.minMessagesPerSession(3.0);
      expect(guardrail.metricName).toBe('messages_per_session');
      expect(guardrail.threshold).toBe(3.0);
    });

    it('should create maxBounceRate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxBounceRate(0.5);
      expect(guardrail.metricName).toBe('bounce_rate');
      expect(guardrail.threshold).toBe(0.5);
    });
  });

  describe('Resource Utilization Guardrails', () => {
    it('should create maxCPUUsage guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxCPUUsage(70);
      expect(guardrail.metricName).toBe('cpu_usage_percent');
      expect(guardrail.threshold).toBe(70);
      expect(guardrail.severity).toBe('critical');
    });

    it('should create maxMemoryUsage guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxMemoryUsage(90);
      expect(guardrail.metricName).toBe('memory_usage_percent');
      expect(guardrail.threshold).toBe(90);
    });

    it('should create maxRequestRate guardrail', () => {
      const guardrail = GUARDRAIL_TEMPLATES.maxRequestRate(2000);
      expect(guardrail.metricName).toBe('requests_per_second');
      expect(guardrail.threshold).toBe(2000);
    });
  });

  describe('Guardrail Presets', () => {
    it('should create speechToText preset', () => {
      const guardrails = GUARDRAIL_PRESETS.speechToText();
      expect(guardrails).toHaveLength(4);
      expect(guardrails[0].metricName).toBe('error_rate');
      expect(guardrails[1].metricName).toBe('latency_p95');
      expect(guardrails[2].metricName).toBe('word_error_rate');
      expect(guardrails[3].metricName).toBe('cost_per_request');
    });

    it('should create chatbot preset', () => {
      const guardrails = GUARDRAIL_PRESETS.chatbot();
      expect(guardrails).toHaveLength(5);
      expect(guardrails[0].metricName).toBe('error_rate');
      expect(guardrails[1].metricName).toBe('user_satisfaction');
    });

    it('should create multiModel preset', () => {
      const guardrails = GUARDRAIL_PRESETS.multiModel();
      expect(guardrails).toHaveLength(4);
      expect(guardrails[0].metricName).toBe('cost_per_request');
    });

    it('should create ecommerce preset', () => {
      const guardrails = GUARDRAIL_PRESETS.ecommerce();
      expect(guardrails).toHaveLength(5);
      expect(guardrails[0].metricName).toBe('conversion_rate');
    });

    it('should create api preset', () => {
      const guardrails = GUARDRAIL_PRESETS.api();
      expect(guardrails).toHaveLength(5);
      expect(guardrails[0].metricName).toBe('latency_p95');
    });

    it('should create contentRecommendation preset', () => {
      const guardrails = GUARDRAIL_PRESETS.contentRecommendation();
      expect(guardrails).toHaveLength(4);
      expect(guardrails[0].metricName).toBe('session_duration_avg');
    });

    it('should create infrastructure preset', () => {
      const guardrails = GUARDRAIL_PRESETS.infrastructure();
      expect(guardrails).toHaveLength(5);
      expect(guardrails[2].metricName).toBe('cpu_usage_percent');
    });

    it('should create minimal preset', () => {
      const guardrails = GUARDRAIL_PRESETS.minimal();
      expect(guardrails).toHaveLength(2);
    });

    it('should create strict preset', () => {
      const guardrails = GUARDRAIL_PRESETS.strict();
      expect(guardrails).toHaveLength(7);
      expect(guardrails[0].threshold).toBe(0.001);
    });
  });

  describe('createGuardrail', () => {
    it('should create custom guardrail with all parameters', () => {
      const guardrail = createGuardrail(
        'custom_metric',
        '<',
        100,
        'critical',
        'Custom description'
      );

      expect(guardrail.metricName).toBe('custom_metric');
      expect(guardrail.operator).toBe('<');
      expect(guardrail.threshold).toBe(100);
      expect(guardrail.severity).toBe('critical');
      expect(guardrail.description).toBe('Custom description');
    });

    it('should create guardrail with default description', () => {
      const guardrail = createGuardrail('test_metric', '>', 50, 'warning');
      expect(guardrail.description).toContain('test_metric');
      expect(guardrail.description).toContain('>');
      expect(guardrail.description).toContain('50');
    });

    it('should support all operators', () => {
      const operators: Array<'>' | '<' | '>=' | '<='> = ['>', '<', '>=', '<='];
      operators.forEach(op => {
        const guardrail = createGuardrail('metric', op, 10, 'warning');
        expect(guardrail.operator).toBe(op);
      });
    });
  });

  describe('getTemplate', () => {
    it('should get template with default threshold', () => {
      const guardrail = getTemplate('maxErrorRate');
      expect(guardrail.threshold).toBe(0.01);
    });

    it('should get template with custom threshold', () => {
      const guardrail = getTemplate('maxErrorRate', 0.03);
      expect(guardrail.threshold).toBe(0.03);
    });

    it('should throw error for unknown template', () => {
      expect(() => {
        getTemplate('nonExistentTemplate' as any);
      }).toThrow('Unknown guardrail template');
    });

    it('should work with all template names', () => {
      const templates: Array<keyof typeof GUARDRAIL_TEMPLATES> = [
        'maxErrorRate',
        'maxP50Latency',
        'maxCostPerRequest',
        'minUserSatisfaction'
      ];

      templates.forEach(name => {
        const guardrail = getTemplate(name);
        expect(guardrail).toBeDefined();
        expect(guardrail.metricName).toBeDefined();
      });
    });
  });

  describe('getPreset', () => {
    it('should get preset by name', () => {
      const guardrails = getPreset('speechToText');
      expect(Array.isArray(guardrails)).toBe(true);
      expect(guardrails.length).toBeGreaterThan(0);
    });

    it('should throw error for unknown preset', () => {
      expect(() => {
        getPreset('nonExistentPreset' as any);
      }).toThrow('Unknown guardrail preset');
    });

    it('should work with all preset names', () => {
      const presets: Array<keyof typeof GUARDRAIL_PRESETS> = [
        'speechToText',
        'chatbot',
        'multiModel',
        'ecommerce',
        'api',
        'contentRecommendation',
        'infrastructure',
        'minimal',
        'strict'
      ];

      presets.forEach(name => {
        const guardrails = getPreset(name);
        expect(guardrails).toBeDefined();
        expect(Array.isArray(guardrails)).toBe(true);
      });
    });
  });
});
