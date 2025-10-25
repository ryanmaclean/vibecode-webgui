/**
 * Bayesian Analysis for A/B Testing
 *
 * Provides Bayesian statistical methods for continuous experiment monitoring without
 * the need for fixed sample sizes or p-value corrections. Bayesian methods answer
 * the question: "What is the probability that treatment is better than control?"
 *
 * Key advantages over frequentist methods:
 * - No need for multiple testing corrections
 * - Can peek at results anytime without inflating error rates
 * - Provides probability statements that are easier to interpret
 * - Incorporates prior knowledge
 * - Calculates expected loss to inform stop decisions
 *
 * References:
 * - VWO SmartStats: https://vwo.com/downloads/VWO_SmartStats_technical_whitepaper.pdf
 * - Optimizely Stats Engine: https://www.optimizely.com/resources/stats-engine/
 * - Kruschke, J. K. (2014). Doing Bayesian Data Analysis
 */

/**
 * Result of Bayesian analysis
 */
export interface BayesianResult {
  /** Posterior mean (expected value) */
  posteriorMean: number;

  /** Credible interval (Bayesian confidence interval) */
  credibleInterval: {
    lower: number;
    upper: number;
  };

  /** Probability that treatment is better than control */
  probabilityBetter: number;

  /** Expected loss if we choose treatment but control is actually better */
  expectedLoss: number;

  /** Variant information (for proportion tests) */
  variant?: {
    alpha: number;  // Beta distribution posterior alpha parameter
    beta: number;   // Beta distribution posterior beta parameter
  };
}

/**
 * Bayesian A/B test for conversion rates (proportions)
 *
 * Uses Beta-Binomial conjugate prior model:
 * - Prior: Beta(α₀, β₀)
 * - Likelihood: Binomial(n, p)
 * - Posterior: Beta(α₀ + successes, β₀ + failures)
 *
 * Default uninformative prior: Beta(1, 1) = Uniform(0, 1)
 *
 * @param controlSuccesses - Number of conversions in control
 * @param controlTotal - Total users in control
 * @param treatmentSuccesses - Number of conversions in treatment
 * @param treatmentTotal - Total users in treatment
 * @param priorAlpha - Prior alpha parameter (default: 1, uninformative)
 * @param priorBeta - Prior beta parameter (default: 1, uninformative)
 * @returns BayesianResult with posterior statistics and decision metrics
 *
 * @example
 * // Control: 450 conversions out of 5000 users (9% rate)
 * // Treatment: 520 conversions out of 5000 users (10.4% rate)
 * const result = bayesianTest(450, 5000, 520, 5000);
 *
 * console.log(`P(Treatment > Control) = ${(result.probabilityBetter * 100).toFixed(1)}%`);
 * console.log(`Expected loss if wrong: ${result.expectedLoss.toFixed(4)}`);
 *
 * if (result.probabilityBetter > 0.95 && result.expectedLoss < 0.001) {
 *   console.log('Strong evidence for treatment. Safe to ship.');
 * }
 */
export function bayesianTest(
  controlSuccesses: number,
  controlTotal: number,
  treatmentSuccesses: number,
  treatmentTotal: number,
  priorAlpha: number = 1,
  priorBeta: number = 1
): BayesianResult {
  // Posterior parameters for Beta distributions
  const controlAlpha = priorAlpha + controlSuccesses;
  const controlBeta = priorBeta + (controlTotal - controlSuccesses);
  const treatmentAlpha = priorAlpha + treatmentSuccesses;
  const treatmentBeta = priorBeta + (treatmentTotal - treatmentSuccesses);

  // Posterior means (expected conversion rates)
  const controlMean = controlAlpha / (controlAlpha + controlBeta);
  const treatmentMean = treatmentAlpha / (treatmentAlpha + treatmentBeta);

  // Credible interval for treatment using quantiles of Beta distribution
  const credibleInterval = {
    lower: betaQuantile(0.025, treatmentAlpha, treatmentBeta),
    upper: betaQuantile(0.975, treatmentAlpha, treatmentBeta)
  };

  // P(treatment > control) - probability treatment is better
  // For Beta distributions, use Monte Carlo simulation for accuracy
  const probabilityBetter = calculateProbabilityBetter(
    controlAlpha,
    controlBeta,
    treatmentAlpha,
    treatmentBeta
  );

  // Expected loss if we choose treatment but control is actually better
  const expectedLoss = calculateExpectedLoss(
    controlAlpha,
    controlBeta,
    treatmentAlpha,
    treatmentBeta
  );

  return {
    posteriorMean: treatmentMean,
    credibleInterval,
    probabilityBetter,
    expectedLoss,
    variant: {
      alpha: treatmentAlpha,
      beta: treatmentBeta
    }
  };
}

/**
 * Bayesian t-test for continuous metrics (e.g., revenue, time-on-site)
 *
 * Uses Normal-Inverse-Gamma conjugate prior model for unknown mean and variance.
 * For simplicity, uses empirical Bayes with uninformative priors.
 *
 * @param controlData - Array of continuous values from control
 * @param treatmentData - Array of continuous values from treatment
 * @returns BayesianResult with posterior statistics
 *
 * @example
 * const controlRevenue = [23.50, 45.20, 12.30, 67.80, ...];
 * const treatmentRevenue = [28.40, 52.10, 15.60, 71.20, ...];
 * const result = bayesianTTest(controlRevenue, treatmentRevenue);
 *
 * if (result.probabilityBetter > 0.9) {
 *   console.log('High confidence that treatment increases revenue');
 * }
 */
export function bayesianTTest(
  controlData: number[],
  treatmentData: number[]
): BayesianResult {
  if (controlData.length < 2 || treatmentData.length < 2) {
    return {
      posteriorMean: 0,
      credibleInterval: { lower: 0, upper: 0 },
      probabilityBetter: 0.5,
      expectedLoss: 0
    };
  }

  const controlMean = mean(controlData);
  const treatmentMean = mean(treatmentData);
  const controlStd = standardDeviation(controlData);
  const treatmentStd = standardDeviation(treatmentData);
  const controlN = controlData.length;
  const treatmentN = treatmentData.length;

  // Monte Carlo simulation for P(treatment > control)
  const numSamples = 10000;
  let betterCount = 0;
  let totalLoss = 0;

  for (let i = 0; i < numSamples; i++) {
    // Sample from posterior distributions (using normal approximation)
    const controlSample = sampleNormal(
      controlMean,
      controlStd / Math.sqrt(controlN)
    );
    const treatmentSample = sampleNormal(
      treatmentMean,
      treatmentStd / Math.sqrt(treatmentN)
    );

    if (treatmentSample > controlSample) {
      betterCount++;
    } else {
      totalLoss += (controlSample - treatmentSample);
    }
  }

  const probabilityBetter = betterCount / numSamples;
  const expectedLoss = totalLoss / numSamples;

  // Credible interval using normal approximation
  const treatmentSE = treatmentStd / Math.sqrt(treatmentN);
  const credibleInterval = {
    lower: treatmentMean - 1.96 * treatmentSE,
    upper: treatmentMean + 1.96 * treatmentSE
  };

  return {
    posteriorMean: treatmentMean,
    credibleInterval,
    probabilityBetter,
    expectedLoss: Math.abs(expectedLoss)
  };
}

/**
 * Calculate probability that treatment is better than control
 *
 * For Beta(α₁, β₁) vs Beta(α₂, β₂), uses exact formula when possible,
 * otherwise Monte Carlo simulation
 *
 * @param controlAlpha - Control posterior alpha
 * @param controlBeta - Control posterior beta
 * @param treatmentAlpha - Treatment posterior alpha
 * @param treatmentBeta - Treatment posterior beta
 * @returns P(treatment > control)
 */
function calculateProbabilityBetter(
  controlAlpha: number,
  controlBeta: number,
  treatmentAlpha: number,
  treatmentBeta: number
): number {
  // Use Monte Carlo for general case
  const numSamples = 10000;
  let betterCount = 0;

  for (let i = 0; i < numSamples; i++) {
    const controlSample = sampleBeta(controlAlpha, controlBeta);
    const treatmentSample = sampleBeta(treatmentAlpha, treatmentBeta);

    if (treatmentSample > controlSample) {
      betterCount++;
    }
  }

  return betterCount / numSamples;
}

/**
 * Calculate expected loss if we choose treatment but control is better
 *
 * Expected loss = E[max(0, control - treatment)]
 *
 * This metric helps make risk-aware decisions. Low expected loss means
 * even if we're wrong, the downside is small.
 *
 * @param controlAlpha - Control posterior alpha
 * @param controlBeta - Control posterior beta
 * @param treatmentAlpha - Treatment posterior alpha
 * @param treatmentBeta - Treatment posterior beta
 * @returns Expected loss value
 */
function calculateExpectedLoss(
  controlAlpha: number,
  controlBeta: number,
  treatmentAlpha: number,
  treatmentBeta: number
): number {
  const numSamples = 10000;
  let totalLoss = 0;

  for (let i = 0; i < numSamples; i++) {
    const controlSample = sampleBeta(controlAlpha, controlBeta);
    const treatmentSample = sampleBeta(treatmentAlpha, treatmentBeta);

    // Loss occurs when control is better than treatment
    if (controlSample > treatmentSample) {
      totalLoss += (controlSample - treatmentSample);
    }
  }

  return totalLoss / numSamples;
}

/**
 * Determine if experiment should stop based on Bayesian criteria
 *
 * Stop criteria:
 * 1. High confidence (P > threshold) AND low expected loss
 * 2. OR sufficient evidence of no difference (credible interval contains 0)
 *
 * @param result - BayesianResult from test
 * @param probabilityThreshold - Minimum P(better) to declare winner (default: 0.95)
 * @param lossThreshold - Maximum acceptable expected loss (default: 0.01 = 1%)
 * @returns Decision object with recommendation
 */
export function shouldStopExperiment(
  result: BayesianResult,
  probabilityThreshold: number = 0.95,
  lossThreshold: number = 0.01
): {
  shouldStop: boolean;
  decision: 'ship_treatment' | 'keep_control' | 'continue' | 'no_difference';
  confidence: number;
  reasoning: string;
} {
  const { probabilityBetter, expectedLoss, credibleInterval } = result;

  // Check for treatment winner
  if (probabilityBetter >= probabilityThreshold && expectedLoss <= lossThreshold) {
    return {
      shouldStop: true,
      decision: 'ship_treatment',
      confidence: probabilityBetter,
      reasoning: `High confidence (${(probabilityBetter * 100).toFixed(1)}%) that treatment is better with low risk (expected loss: ${(expectedLoss * 100).toFixed(2)}%)`
    };
  }

  // Check for control winner (treatment is worse)
  const probabilityWorse = 1 - probabilityBetter;
  if (probabilityWorse >= probabilityThreshold) {
    return {
      shouldStop: true,
      decision: 'keep_control',
      confidence: probabilityWorse,
      reasoning: `High confidence (${(probabilityWorse * 100).toFixed(1)}%) that control is better. Treatment performs worse.`
    };
  }

  // Check for no practical difference
  const ciContainsZero = credibleInterval.lower <= 0 && credibleInterval.upper >= 0;
  const ciIsNarrow = Math.abs(credibleInterval.upper - credibleInterval.lower) < 0.02;

  if (ciContainsZero && ciIsNarrow) {
    return {
      shouldStop: true,
      decision: 'no_difference',
      confidence: 0.95,
      reasoning: 'Credible interval is narrow and contains zero. No meaningful difference detected.'
    };
  }

  // Continue collecting data
  const samplesNeeded = estimateSamplesNeeded(probabilityBetter, probabilityThreshold);

  return {
    shouldStop: false,
    decision: 'continue',
    confidence: probabilityBetter,
    reasoning: `Insufficient evidence. P(better) = ${(probabilityBetter * 100).toFixed(1)}%. Continue collecting data (estimated ${samplesNeeded} more samples needed).`
  };
}

/**
 * Estimate how many more samples are needed to reach a decision
 *
 * Very rough heuristic based on current probability
 */
function estimateSamplesNeeded(currentProb: number, targetProb: number): number {
  if (currentProb >= targetProb) return 0;

  const gap = targetProb - currentProb;
  const progressRate = Math.max(0.01, currentProb - 0.5); // Distance from 50%

  if (progressRate <= 0.01) return 999999; // Very uncertain

  // Rough estimate: samples needed scales with gap / progress_rate
  const estimate = (gap / progressRate) * 1000;

  return Math.min(999999, Math.ceil(estimate));
}

// ==================== DISTRIBUTION SAMPLING ====================

/**
 * Sample from Beta distribution using Cheng's algorithm
 *
 * @param alpha - Alpha parameter (> 0)
 * @param beta - Beta parameter (> 0)
 * @returns Random sample from Beta(alpha, beta)
 */
function sampleBeta(alpha: number, beta: number): number {
  // Use gamma variates: if X ~ Gamma(α), Y ~ Gamma(β), then X/(X+Y) ~ Beta(α, β)
  const x = sampleGamma(alpha);
  const y = sampleGamma(beta);
  return x / (x + y);
}

/**
 * Sample from Gamma distribution using Marsaglia and Tsang's method
 *
 * @param alpha - Shape parameter (> 0)
 * @returns Random sample from Gamma(alpha, 1)
 */
function sampleGamma(alpha: number): number {
  if (alpha < 1) {
    // Use acceptance-rejection method for alpha < 1
    return sampleGamma(alpha + 1) * Math.pow(Math.random(), 1 / alpha);
  }

  // Marsaglia and Tsang's method for alpha >= 1
  const d = alpha - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);

  while (true) {
    let x, v;
    do {
      x = sampleNormal(0, 1);
      v = 1 + c * x;
    } while (v <= 0);

    v = v * v * v;
    const u = Math.random();
    const xSquared = x * x;

    if (u < 1 - 0.0331 * xSquared * xSquared) {
      return d * v;
    }

    if (Math.log(u) < 0.5 * xSquared + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

/**
 * Sample from Normal distribution using Box-Muller transform
 *
 * @param mean - Mean of normal distribution
 * @param stdDev - Standard deviation
 * @returns Random sample from N(mean, stdDev²)
 */
function sampleNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  const u1 = Math.random();
  const u2 = Math.random();

  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + stdDev * z;
}

/**
 * Calculate quantile (inverse CDF) of Beta distribution
 *
 * @param p - Probability (0 < p < 1)
 * @param alpha - Alpha parameter
 * @param beta - Beta parameter
 * @returns x such that P(X ≤ x) = p for X ~ Beta(alpha, beta)
 */
function betaQuantile(p: number, alpha: number, beta: number): number {
  // Use Newton-Raphson method
  let x = alpha / (alpha + beta); // Initial guess: mean of distribution
  const tolerance = 1e-8;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    const cdf = incompleteBeta(x, alpha, beta);
    const pdf = betaPDF(x, alpha, beta);

    if (Math.abs(cdf - p) < tolerance) {
      return x;
    }

    if (pdf === 0) break; // Avoid division by zero

    // Newton-Raphson update
    x = x - (cdf - p) / pdf;

    // Keep x in valid range [0, 1]
    x = Math.max(0, Math.min(1, x));
  }

  return x;
}

/**
 * Beta distribution PDF
 */
function betaPDF(x: number, alpha: number, beta: number): number {
  if (x <= 0 || x >= 1) return 0;

  return (
    Math.pow(x, alpha - 1) *
    Math.pow(1 - x, beta - 1) /
    betaFunction(alpha, beta)
  );
}

/**
 * Beta function B(α, β) = Γ(α)Γ(β) / Γ(α+β)
 */
function betaFunction(alpha: number, beta: number): number {
  return (
    Math.exp(logGamma(alpha) + logGamma(beta) - logGamma(alpha + beta))
  );
}

/**
 * Incomplete beta function (CDF of beta distribution)
 */
function incompleteBeta(x: number, alpha: number, beta: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use continued fraction expansion
  const bt = Math.exp(
    logGamma(alpha + beta) - logGamma(alpha) - logGamma(beta) +
    alpha * Math.log(x) + beta * Math.log(1 - x)
  );

  if (x < (alpha + 1) / (alpha + beta + 2)) {
    return bt * betaContinuedFraction(x, alpha, beta) / alpha;
  } else {
    return 1 - bt * betaContinuedFraction(1 - x, beta, alpha) / beta;
  }
}

/**
 * Continued fraction for incomplete beta
 */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const maxIterations = 200;
  const epsilon = 1e-15;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - qab * x / qap;

  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < epsilon) break;
  }

  return h;
}

/**
 * Log of gamma function (using Lanczos approximation)
 */
function logGamma(x: number): number {
  const coefficients = [
    76.18009172947146,
    -86.50532032941677,
    24.01409824083091,
    -1.231739572450155,
    0.1208650973866179e-2,
    -0.5395239384953e-5
  ];

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  for (let j = 0; j < 6; j++) {
    y += 1;
    ser += coefficients[j] / y;
  }

  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

// ==================== UTILITY FUNCTIONS ====================

/**
 * Calculate mean of array
 */
function mean(data: number[]): number {
  return data.reduce((sum, x) => sum + x, 0) / data.length;
}

/**
 * Calculate sample standard deviation
 */
function standardDeviation(data: number[]): number {
  const avg = mean(data);
  const squaredDiffs = data.map(x => Math.pow(x - avg, 2));
  const variance = squaredDiffs.reduce((sum, x) => sum + x, 0) / (data.length - 1);
  return Math.sqrt(variance);
}
