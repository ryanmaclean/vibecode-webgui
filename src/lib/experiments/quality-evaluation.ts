/**
 * Quality Evaluation System
 *
 * Provides multiple methods for evaluating AI model response quality:
 * 1. User ratings (explicit feedback)
 * 2. LLM-as-judge (GPT-4 evaluates other models)
 * 3. Heuristic scoring (length, structure, confidence)
 * 4. Similarity to expected answer (if available)
 */

import { OpenRouter } from '@/lib/openrouter-client';

/**
 * Quality evaluation result
 */
export interface QualityEvaluation {
  score: number; // 0-1
  metrics: {
    relevance: number; // 0-1
    completeness: number; // 0-1
    accuracy: number; // 0-1
    coherence: number; // 0-1
  };
  method: 'user_rating' | 'llm_judge' | 'similarity' | 'heuristic';
  reasoning?: string;
}

/**
 * Evaluate answer quality using best available method
 *
 * Priority:
 * 1. User rating (if available)
 * 2. Expected answer similarity (if available)
 * 3. LLM-as-judge (for important queries)
 * 4. Heuristic scoring (fast fallback)
 *
 * @param question - User's question
 * @param answer - Model's answer
 * @param expectedAnswer - Optional expected answer for comparison
 * @param userRating - Optional user rating (1-5)
 * @param useLLMJudge - Whether to use LLM-as-judge (costs money)
 * @returns Quality evaluation
 */
export async function evaluateQuality(
  question: string,
  answer: string,
  expectedAnswer?: string,
  userRating?: number,
  useLLMJudge: boolean = false
): Promise<QualityEvaluation> {
  // Priority 1: User rating
  if (userRating !== undefined) {
    return fromUserRating(userRating);
  }

  // Priority 2: Similarity to expected answer
  if (expectedAnswer) {
    return fromSimilarity(answer, expectedAnswer);
  }

  // Priority 3: LLM-as-judge (expensive)
  if (useLLMJudge) {
    try {
      return await llmJudge(question, answer);
    } catch (error) {
      console.warn('LLM judge failed, falling back to heuristic:', error);
    }
  }

  // Priority 4: Heuristic scoring
  return fromHeuristic(answer);
}

/**
 * Convert user rating to quality evaluation
 *
 * @param rating - User rating (1-5)
 * @returns Quality evaluation
 */
function fromUserRating(rating: number): QualityEvaluation {
  // Normalize rating to 0-1 scale
  const score = (rating - 1) / 4;

  return {
    score,
    metrics: {
      relevance: score,
      completeness: score,
      accuracy: score,
      coherence: score
    },
    method: 'user_rating'
  };
}

/**
 * Use LLM-as-judge to evaluate answer quality
 *
 * Uses GPT-4 to evaluate the quality of another model's answer.
 * Costs ~$0.01 per evaluation but provides high-quality judgments.
 *
 * @param question - User's question
 * @param answer - Model's answer to evaluate
 * @returns Quality evaluation with reasoning
 */
export async function llmJudge(
  question: string,
  answer: string
): Promise<QualityEvaluation> {
  const apiKey = process.env.OPENROUTER_API_KEY || 'mock-key-for-testing';
  const client = new OpenRouter(apiKey);

  const prompt = `You are an expert evaluator of AI responses. Evaluate the following answer on a scale of 0-1 for each metric.

Question: ${question}

Answer: ${answer}

Evaluate the answer on these dimensions:
1. Relevance (0-1): How well does it address the question?
2. Completeness (0-1): Does it cover all aspects of the question?
3. Accuracy (0-1): Is the information correct and factual?
4. Coherence (0-1): Is it well-structured and easy to understand?

Respond in JSON format:
{
  "relevance": <0-1>,
  "completeness": <0-1>,
  "accuracy": <0-1>,
  "coherence": <0-1>,
  "reasoning": "<brief explanation>"
}`;

  try {
    const response = await client.createChatCompletion({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500
    });

    const content = response.choices[0]?.message?.content || '{}';

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const json = jsonMatch ? JSON.parse(jsonMatch[0]) : {};

    const metrics = {
      relevance: json.relevance || 0.7,
      completeness: json.completeness || 0.7,
      accuracy: json.accuracy || 0.7,
      coherence: json.coherence || 0.7
    };

    // Overall score is weighted average
    const score =
      metrics.relevance * 0.3 +
      metrics.completeness * 0.25 +
      metrics.accuracy * 0.3 +
      metrics.coherence * 0.15;

    return {
      score: Math.max(0, Math.min(1, score)),
      metrics,
      method: 'llm_judge',
      reasoning: json.reasoning
    };
  } catch (error) {
    console.error('LLM judge failed:', error);
    // Fallback to heuristic
    return fromHeuristic(answer);
  }
}

/**
 * Simple heuristic scoring based on answer characteristics
 *
 * Evaluates:
 * - Length (longer answers tend to be more complete)
 * - Structure (lists, examples, steps)
 * - Confidence phrases
 * - Code blocks (for technical questions)
 *
 * @param answer - Model's answer
 * @returns Quality evaluation
 */
export function heuristicScore(answer: string): number {
  let score = 0;

  // Length score (up to 0.3)
  // Ideal length: 200-1000 characters
  const length = answer.length;
  if (length < 50) {
    score += 0.05;
  } else if (length < 200) {
    score += 0.15;
  } else if (length < 1000) {
    score += 0.30;
  } else if (length < 2000) {
    score += 0.25;
  } else {
    score += 0.20; // Too long might be rambling
  }

  // Structure score (up to 0.3)
  const hasLists = /^[\s]*[-*•]\s/m.test(answer) || /^\d+\./m.test(answer);
  const hasHeadings = /^#{1,3}\s/m.test(answer) || /^[A-Z][^.!?]*:$/m.test(answer);
  const hasParagraphs = answer.split('\n\n').length > 1;

  if (hasLists) score += 0.1;
  if (hasHeadings) score += 0.1;
  if (hasParagraphs) score += 0.1;

  // Content quality (up to 0.25)
  const hasExamples = /example|for instance|such as/i.test(answer);
  const hasExplanations = /because|therefore|thus|since/i.test(answer);
  const hasCodeBlocks = /```[\s\S]*?```/.test(answer);

  if (hasExamples) score += 0.1;
  if (hasExplanations) score += 0.1;
  if (hasCodeBlocks) score += 0.05;

  // Confidence indicators (up to 0.15)
  const hasConfidence = /\b(should|will|can|typically|generally)\b/i.test(answer);
  const hasQualifiers = /\b(may|might|could|possibly)\b/i.test(answer);
  const balancedConfidence = hasConfidence && hasQualifiers;

  if (balancedConfidence) score += 0.15;
  else if (hasConfidence) score += 0.10;
  else if (hasQualifiers) score += 0.05;

  return Math.max(0, Math.min(1, score));
}

/**
 * Full heuristic evaluation with metrics breakdown
 *
 * @param answer - Model's answer
 * @returns Quality evaluation
 */
function fromHeuristic(answer: string): QualityEvaluation {
  const overallScore = heuristicScore(answer);

  // Derive individual metrics from heuristic features
  const length = answer.length;
  const hasStructure = /^[\s]*[-*•]\s/m.test(answer) || /^\d+\./m.test(answer);
  const hasExamples = /example|for instance|such as/i.test(answer);
  const hasCodeBlocks = /```[\s\S]*?```/.test(answer);

  return {
    score: overallScore,
    metrics: {
      relevance: overallScore, // Assume relevance matches overall
      completeness: Math.min(1, length / 500 + (hasExamples ? 0.2 : 0)),
      accuracy: overallScore * 0.9, // Slightly lower since we can't verify
      coherence: hasStructure ? 0.8 : 0.6
    },
    method: 'heuristic'
  };
}

/**
 * Calculate similarity between answer and expected answer
 *
 * Uses simple token-based similarity (Jaccard index).
 * For more accuracy, could use embeddings or semantic similarity.
 *
 * @param answer - Model's answer
 * @param expectedAnswer - Expected correct answer
 * @returns Quality evaluation based on similarity
 */
function fromSimilarity(answer: string, expectedAnswer: string): QualityEvaluation {
  const answerTokens = tokenize(answer.toLowerCase());
  const expectedTokens = tokenize(expectedAnswer.toLowerCase());

  // Jaccard similarity
  const intersection = answerTokens.filter(token => expectedTokens.includes(token));
  const union = [...new Set([...answerTokens, ...expectedTokens])];

  const similarity = intersection.length / union.length;

  // Length ratio (penalize if too short or too long)
  const lengthRatio = Math.min(answer.length, expectedAnswer.length) /
                      Math.max(answer.length, expectedAnswer.length);

  // Combined score
  const score = similarity * 0.7 + lengthRatio * 0.3;

  return {
    score: Math.max(0, Math.min(1, score)),
    metrics: {
      relevance: similarity,
      completeness: lengthRatio,
      accuracy: similarity,
      coherence: 0.8 // Assume coherent if similar
    },
    method: 'similarity'
  };
}

/**
 * Tokenize text into words
 *
 * @param text - Text to tokenize
 * @returns Array of tokens
 */
function tokenize(text: string): string[] {
  return text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length > 2); // Remove short words
}

/**
 * Batch evaluate multiple answers
 *
 * @param questions - Array of questions
 * @param answers - Array of answers
 * @param expectedAnswers - Optional array of expected answers
 * @returns Array of quality evaluations
 */
export async function batchEvaluate(
  questions: string[],
  answers: string[],
  expectedAnswers?: string[]
): Promise<QualityEvaluation[]> {
  const evaluations = await Promise.all(
    questions.map((question, i) =>
      evaluateQuality(
        question,
        answers[i],
        expectedAnswers?.[i],
        undefined,
        false // Don't use LLM judge for batch (too expensive)
      )
    )
  );

  return evaluations;
}

/**
 * Calculate average quality across multiple evaluations
 *
 * @param evaluations - Array of quality evaluations
 * @returns Average quality score
 */
export function averageQuality(evaluations: QualityEvaluation[]): number {
  if (evaluations.length === 0) return 0;

  const sum = evaluations.reduce((acc, eval) => acc + eval.score, 0);
  return sum / evaluations.length;
}
