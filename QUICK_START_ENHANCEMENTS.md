# Quick Start: New Features (Nov 2025)

## 🚀 What's New

### 1. Code Explanation (Anti-"Vibe Coding")
**Location**: Workspace RAG Extension

**How to Use**:
```typescript
import { CodeExplainerService } from './codeExplainer';

const explainer = new CodeExplainerService();
const explanation = await explainer.explainCode(yourCode, context);

// Get complexity score
console.log(explanation.complexity.overall); // 'simple' | 'moderate' | 'complex'

// Get detected patterns
console.log(explanation.patterns); // Array of design patterns

// Get warnings
console.log(explanation.warnings); // Complexity/anti-pattern warnings

// Get simpler alternatives
console.log(explanation.alternatives); // Suggested refactorings
```

### 2. Token Tracking & Cost Controls
**Location**: Workspace RAG Extension

**How to Use**:
```typescript
import { TokenTracker } from './tokenTracker';

const tracker = new TokenTracker(context);

// Track usage
await tracker.trackUsage({
  provider: 'openai',
  model: 'gpt-4-turbo-preview',
  operation: 'completion',
  promptTokens: 100,
  completionTokens: 50,
  totalTokens: 150
});

// Set budget
await tracker.setBudget('daily', 10.00, 80); // $10/day, alert at 80%

// Get usage summary
const summary = tracker.getUsageSummary('week');
console.log(`Total cost this week: $${summary.totalCost}`);

// Check before expensive operation
const estimate = tracker.estimateCost('gpt-4', 1000, 500);
if (tracker.wouldExceedBudget(estimate.totalCost)) {
  console.warn('This would exceed your budget!');
}
```

### 3. Cost-Optimized CI/CD
**Location**: `.github/workflows/cost-optimized-main.yml`

**How It Works**:
- Main branch: Fast checks only (~13 min)
- Release branches: Full test suite (separate workflow)
- Expected savings: 70-80%

**To Create Release Branch**:
```bash
./scripts/create-release-branch.sh v1.2.3
```

### 4. Security Guide
**Location**: `docs/security/SECURITY_GUIDE.md`

**Quick Links**:
- API Key Management: Section 2
- Credential Rotation: Section 3
- Incident Response: Section 5
- Security Checklist: Section 4

---

## 📊 Monitoring Your Costs

### View Token Usage
```typescript
const summary = tracker.getUsageSummary('day');
console.log('Today:', {
  tokens: summary.totalTokens,
  cost: summary.totalCost,
  topProvider: Array.from(summary.byProvider.entries())[0]
});
```

### Get Optimization Suggestions
```typescript
const suggestions = tracker.getOptimizationSuggestions();
for (const suggestion of suggestions) {
  console.log(`${suggestion.severity}: ${suggestion.message}`);
  console.log(`Potential savings: $${suggestion.potentialSavings}`);
}
```

### Compare Provider Costs
```typescript
const comparisons = tracker.compareProviderCosts(1000, 500);
console.log('Cheapest:', comparisons[0]);
console.log('Most expensive:', comparisons[comparisons.length - 1]);
```

---

## 🔒 Security Quick Reference

### Store API Key Securely
```typescript
// ✅ CORRECT
await vscode.workspace.getConfiguration('workspaceRag')
  .update('apiKey', key, vscode.ConfigurationTarget.Global);

// ❌ WRONG
const apiKey = 'sk-hardcoded-key'; // Never do this!
```

### Rotate Credentials
```bash
# Automated
./scripts/security/rotate-credentials.sh production api-keys

# Manual
# See docs/security/SECURITY_GUIDE.md Section 3
```

### Incident Response
```bash
# API Key Exposed
./scripts/security/revoke-key.sh sk-exposed-key
./scripts/security/rotate-credentials.sh production api-keys

# See full playbook: docs/security/SECURITY_GUIDE.md Section 5
```

---

## 📚 Documentation

- **Implementation Plan**: `IMPLEMENTATION_PLAN.md`
- **Security Guide**: `docs/security/SECURITY_GUIDE.md`
- **Enhancements Overview**: `docs/ENHANCEMENTS_NOV_2025.md`
- **Extension README**: `extensions/workspace-rag/README.md`

---

## 🐛 Troubleshooting

### Code Explainer Not Working
1. Check TypeScript compilation: `npm run compile`
2. Verify extension activation
3. Check VS Code Developer Tools console

### Token Tracking Shows $0
1. Ensure model is in pricing database
2. Check `tokenTracker.ts` PRICING constant
3. Verify usage is being tracked

### Budget Alerts Not Showing
1. Check budget is set: `tracker.getBudget('daily')`
2. Verify alert threshold (default 80%)
3. Check VS Code notifications settings

---

## 💡 Tips

1. **Start with budgets**: Set daily/weekly limits before using AI features
2. **Review costs weekly**: Check `getUsageSummary('week')` every Monday
3. **Use local embeddings**: On Apple Silicon, use MLX to reduce costs
4. **Check complexity**: Run code explainer on AI-generated code
5. **Learn patterns**: Review detected patterns to improve your skills

---

**Need Help?** See `IMPLEMENTATION_PLAN.md` for detailed documentation.
