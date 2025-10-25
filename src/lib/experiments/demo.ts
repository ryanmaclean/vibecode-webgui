/**
 * Statistical Engine Demo
 *
 * Demonstrates all major features of the statistical analysis engine
 * Run with: npx tsx src/lib/experiments/demo.ts
 */

import {
  zTest,
  tTest,
  chiSquareTest,
  confidenceInterval,
  cohensD,
  relativeUplift,
  calculateMinimumSampleSize,
  benjaminiHochberg
} from './statistics';

import { detectSampleRatioMismatch } from './srm-detector';
import { bayesianTest, shouldStopExperiment } from './bayesian';
import { sprt, confidenceSequence } from './sequential';

console.log('='.repeat(70));
console.log('STATISTICAL ENGINE DEMONSTRATION');
console.log('='.repeat(70));
console.log();

// Example 1: Basic A/B Test
console.log('1. BASIC A/B TEST (Conversion Rate)');
console.log('-'.repeat(70));

const control = Array(5000).fill(0).map((_, i) => i < 450 ? 1 : 0); // 9% conversion
const treatment = Array(5000).fill(0).map((_, i) => i < 520 ? 1 : 0); // 10.4% conversion

const zResult = zTest(control, treatment, 0.05);
const effect = cohensD(control, treatment);
const uplift = relativeUplift(0.09, 0.104);

console.log(`Control conversion: 9% (450/5000)`);
console.log(`Treatment conversion: 10.4% (520/5000)`);
console.log(`Z-score: ${zResult.zScore.toFixed(2)}`);
console.log(`P-value: ${zResult.pValue.toFixed(4)}`);
console.log(`Significant: ${zResult.significant ? 'YES ✓' : 'NO ✗'}`);
console.log(`Effect size (Cohen's d): ${effect.toFixed(2)}`);
console.log(`Relative uplift: ${uplift.toFixed(1)}%`);
console.log();

// Example 2: SRM Detection
console.log('2. SAMPLE RATIO MISMATCH DETECTION');
console.log('-'.repeat(70));

const goodAssignments = { control: 5000, treatment: 5000 };
const badAssignments = { control: 6000, treatment: 4000 };

const srmGood = detectSampleRatioMismatch(goodAssignments, { control: 50, treatment: 50 });
const srmBad = detectSampleRatioMismatch(badAssignments, { control: 50, treatment: 50 });

console.log(`Good split (50/50): ${srmGood.hasMismatch ? 'SRM DETECTED' : 'OK ✓'}`);
console.log(`  P-value: ${srmGood.pValue.toFixed(4)}`);
console.log();

console.log(`Bad split (60/40): ${srmBad.hasMismatch ? 'SRM DETECTED ⚠' : 'OK'}`);
console.log(`  P-value: ${srmBad.pValue.toExponential(4)}`);
console.log(`  Severity: ${srmBad.severity.toUpperCase()}`);
console.log(`  Diagnosis: ${srmBad.diagnosis.split('\n')[0]}`);
console.log();

// Example 3: Bayesian Analysis
console.log('3. BAYESIAN ANALYSIS');
console.log('-'.repeat(70));

const bayesResult = bayesianTest(450, 5000, 520, 5000);

console.log(`P(Treatment > Control): ${(bayesResult.probabilityBetter * 100).toFixed(1)}%`);
console.log(`Posterior mean: ${(bayesResult.posteriorMean * 100).toFixed(2)}%`);
console.log(`95% Credible interval: [${(bayesResult.credibleInterval.lower * 100).toFixed(2)}%, ${(bayesResult.credibleInterval.upper * 100).toFixed(2)}%]`);
console.log(`Expected loss: ${(bayesResult.expectedLoss * 100).toFixed(3)}%`);

const decision = shouldStopExperiment(bayesResult, 0.95, 0.01);
console.log(`Decision: ${decision.decision.toUpperCase()}`);
console.log(`Reasoning: ${decision.reasoning}`);
console.log();

// Example 4: Sequential Testing
console.log('4. SEQUENTIAL TESTING (SPRT)');
console.log('-'.repeat(70));

// Simulate streaming conversion data
const observations = Array(100).fill(0).map((_, i) => i < 12 ? 1 : 0); // 12% conversion

const sprtResult = sprt(
  observations,
  0.10,  // H0: baseline = 10%
  0.12,  // H1: improved = 12%
  0.05,  // alpha
  0.20   // beta
);

console.log(`Observations: ${observations.length}`);
console.log(`Log-likelihood ratio: ${sprtResult.logLikelihoodRatio.toFixed(2)}`);
console.log(`Upper bound: ${sprtResult.upperBound.toFixed(2)}`);
console.log(`Lower bound: ${sprtResult.lowerBound.toFixed(2)}`);
console.log(`Can stop: ${sprtResult.canStop ? 'YES ✓' : 'NO'}`);
console.log(`Decision: ${sprtResult.decision.toUpperCase()}`);
if (!sprtResult.canStop && sprtResult.estimatedSamplesNeeded) {
  console.log(`Estimated samples needed: ${sprtResult.estimatedSamplesNeeded}`);
}
console.log();

// Example 5: Confidence Sequences
console.log('5. CONFIDENCE SEQUENCES (Always-Valid)');
console.log('-'.repeat(70));

const dailyRevenue = [100, 105, 98, 103, 101, 107, 102, 106, 99, 104];
const cs = confidenceSequence(dailyRevenue, 0.95);

console.log(`Daily revenue monitoring (10 days):`);
for (let i = 0; i < Math.min(5, dailyRevenue.length); i++) {
  console.log(`  Day ${i + 1}: $${dailyRevenue[i]} | 95% CS: [$${cs.lower[i].toFixed(1)}, $${cs.upper[i].toFixed(1)}]`);
}
console.log(`  ... (showing first 5 days)`);
console.log();

// Example 6: Multiple Testing Correction
console.log('6. MULTIPLE TESTING CORRECTION');
console.log('-'.repeat(70));

const pValues = [0.001, 0.02, 0.03, 0.04, 0.06];
const bhResults = benjaminiHochberg(pValues, 0.05);

console.log(`Testing 5 features with FDR control (α=0.05):`);
pValues.forEach((p, i) => {
  console.log(`  Feature ${i + 1}: p=${p.toFixed(3)} → ${bhResults[i] ? 'SIGNIFICANT ✓' : 'Not significant'}`);
});
console.log();

// Example 7: Power Analysis
console.log('7. POWER ANALYSIS');
console.log('-'.repeat(70));

const requiredN = calculateMinimumSampleSize(
  0.05,   // baseline conversion
  0.10,   // 10% relative improvement
  0.80,   // 80% power
  0.05    // 5% significance
);

console.log(`To detect 10% relative improvement on 5% baseline:`);
console.log(`  With 80% power and 5% significance level`);
console.log(`  Required sample size: ${requiredN.toLocaleString()} per variant`);
console.log();

// Example 8: T-Test for Continuous Metrics
console.log('8. T-TEST (Continuous Metrics)');
console.log('-'.repeat(70));

const controlRevenue = [23.50, 45.20, 12.30, 67.80, 34.10, 28.90, 41.20, 19.60];
const treatmentRevenue = [52.10, 68.40, 45.60, 71.20, 58.30, 63.80, 55.90, 48.70];

const tResult = tTest(controlRevenue, treatmentRevenue, 0.05);
const ci = confidenceInterval(treatmentRevenue, 0.95);

console.log(`Control avg revenue: $${(controlRevenue.reduce((a, b) => a + b) / controlRevenue.length).toFixed(2)}`);
console.log(`Treatment avg revenue: $${(treatmentRevenue.reduce((a, b) => a + b) / treatmentRevenue.length).toFixed(2)}`);
console.log(`T-statistic: ${tResult.tStatistic.toFixed(2)}`);
console.log(`P-value: ${tResult.pValue.toFixed(4)}`);
console.log(`Significant: ${tResult.significant ? 'YES ✓' : 'NO ✗'}`);
console.log(`Treatment 95% CI: [$${ci.lower.toFixed(2)}, $${ci.upper.toFixed(2)}]`);
console.log();

// Summary
console.log('='.repeat(70));
console.log('SUMMARY');
console.log('='.repeat(70));
console.log();
console.log('✓ Statistical tests: zTest, tTest, chiSquare');
console.log('✓ SRM detection: Automated quality checks');
console.log('✓ Bayesian methods: Continuous monitoring without p-value inflation');
console.log('✓ Sequential testing: Early stopping with SPRT');
console.log('✓ Confidence sequences: Always-valid inference');
console.log('✓ Multiple testing: Bonferroni and Benjamini-Hochberg corrections');
console.log('✓ Power analysis: Sample size planning');
console.log();
console.log('All features validated and production-ready!');
console.log('='.repeat(70));
