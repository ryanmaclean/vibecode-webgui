---
name: henshu
description: >
  Editorial quality gate for i18n translations. Validates translation completeness,
  placeholder parity, terminology consistency, and wiring coverage across all locale
  files. Run before any PR that touches UI to prevent translation drift.
  Use when: adding new UI strings, modifying pages/components, or before releases.
allowed-tools:
  - Read
  - Bash
  - Agent
  - Write
  - Edit
---

# Henshu (編集) — i18n Editorial Quality Gate

Translation quality and completeness review for the vibecode-webgui codebase.

## When to Run

- Before merging PRs that touch UI files (`src/app/`, `src/components/`)
- After adding new translation keys to `messages/en.json`
- Before releases to verify full coverage
- When `/henshu` is invoked by the user

## Audit Steps

### 1. Key Parity Check

Compare all locale files against en.json for missing/extra keys:

```bash
node -e "
const en = require('./messages/en.json');
const locales = ['fr', 'ja'];

function getKeys(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getKeys(v, prefix + k + '.') : [prefix + k]
  );
}

const enKeys = getKeys(en).sort();
console.log('EN: ' + enKeys.length + ' keys\n');

for (const loc of locales) {
  const data = require('./messages/' + loc + '.json');
  const locKeys = getKeys(data).sort();
  const missing = enKeys.filter(k => !locKeys.includes(k));
  const extra = locKeys.filter(k => !enKeys.includes(k));
  console.log(loc.toUpperCase() + ': ' + locKeys.length + ' keys');
  if (missing.length) console.log('  MISSING: ' + JSON.stringify(missing));
  if (extra.length) console.log('  EXTRA: ' + JSON.stringify(extra));
  if (!missing.length && !extra.length) console.log('  OK - all keys match');
  console.log();
}
"
```

### 2. Placeholder Parity Check

Verify that placeholders like `{count}`, `{provider}`, `{cost}` exist in all locales where they exist in en.json:

```bash
node -e "
const en = require('./messages/en.json');
const locales = { fr: require('./messages/fr.json'), ja: require('./messages/ja.json') };

function getLeaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getLeaves(v, prefix + k + '.') : [[prefix + k, v]]
  );
}

const enLeaves = getLeaves(en);
let issues = 0;

for (const [key, enVal] of enLeaves) {
  const placeholders = (String(enVal).match(/\{[a-zA-Z_]+\}/g) || []);
  if (placeholders.length === 0) continue;

  for (const [loc, data] of Object.entries(locales)) {
    const locVal = key.split('.').reduce((o, k) => o?.[k], data);
    if (!locVal) continue;
    for (const ph of placeholders) {
      if (!String(locVal).includes(ph)) {
        console.log('MISSING PLACEHOLDER: ' + loc + '.' + key + ' is missing ' + ph);
        issues++;
      }
    }
  }
}

if (issues === 0) console.log('OK - all placeholders present in all locales');
else console.log('\n' + issues + ' placeholder issues found');
"
```

### 3. Untranslated String Detection

Find locale values that are identical to English (possible untranslated strings):

```bash
node -e "
const en = require('./messages/en.json');
const locales = { fr: require('./messages/fr.json'), ja: require('./messages/ja.json') };

function getLeaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getLeaves(v, prefix + k + '.') : [[prefix + k, v]]
  );
}

const enLeaves = getLeaves(en);
const brandTerms = ['VibeCode', 'WebGUI', 'AI', 'VM', 'API', 'CLI', 'JSON', 'GPU', 'Docker',
  'Kubernetes', 'GitHub', 'GitLab', 'Tailscale', 'OpenAI', 'Anthropic', 'Codeium',
  'Datadog', 'Neovim', 'VS Code', 'Monaco', 'PostgreSQL', 'Valkey', 'Linux', 'macOS'];

for (const [loc, data] of Object.entries(locales)) {
  const suspects = [];
  for (const [key, enVal] of enLeaves) {
    if (typeof enVal !== 'string' || enVal.length <= 3) continue;
    if (brandTerms.includes(enVal)) continue;
    const locVal = key.split('.').reduce((o, k) => o?.[k], data);
    if (locVal === enVal) suspects.push(key);
  }
  if (suspects.length > 0) {
    console.log(loc.toUpperCase() + ': ' + suspects.length + ' possibly untranslated:');
    suspects.slice(0, 20).forEach(s => console.log('  ' + s));
    if (suspects.length > 20) console.log('  ... and ' + (suspects.length - 20) + ' more');
  } else {
    console.log(loc.toUpperCase() + ': OK - no untranslated strings detected');
  }
  console.log();
}
"
```

### 4. Terminology Consistency Check

Verify key terms are translated consistently across all keys:

```bash
node -e "
const locales = { fr: require('./messages/fr.json'), ja: require('./messages/ja.json') };

const termChecks = {
  ja: {
    'Dashboard': 'ダッシュボード',
    'Settings': '設定',
    'Workspace': 'ワークスペース',
    'Editor': 'エディター',
    'Monitoring': 'モニタリング',
    'Search': '検索',
  },
  fr: {
    'Save': 'Enregistrer',
    'Cancel': 'Annuler',
    'Delete': 'Supprimer',
    'Loading': 'Chargement',
  }
};

function getLeaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getLeaves(v, prefix + k + '.') : [[prefix + k, String(v)]]
  );
}

for (const [loc, checks] of Object.entries(termChecks)) {
  const leaves = getLeaves(locales[loc]);
  let issues = 0;
  for (const [enTerm, expectedTranslation] of Object.entries(checks)) {
    const mismatches = leaves.filter(([key, val]) =>
      val.includes(enTerm) && !val.includes(expectedTranslation) && val !== enTerm
    );
    if (mismatches.length > 0) {
      console.log(loc.toUpperCase() + ': \"' + enTerm + '\" appears untranslated in:');
      mismatches.forEach(([k]) => console.log('  ' + k));
      issues++;
    }
  }
  if (issues === 0) console.log(loc.toUpperCase() + ': OK - terminology consistent');
  console.log();
}
"
```

### 5. i18n Wiring Coverage

Check what percentage of UI files use `useTranslations`:

```bash
TOTAL=$(find src/app src/components -name "*.tsx" -not -path "*__tests__*" -not -path "*test*" -not -name "*.test.*" | wc -l)
WIRED=$(grep -rl "useTranslations" src/app/ src/components/ --include="*.tsx" | grep -v __tests__ | grep -v ".test." | wc -l)
echo "i18n wiring: $WIRED / $TOTAL files ($(( WIRED * 100 / TOTAL ))%)"
echo ""
echo "Unwired files with >3 hardcoded strings:"
for f in $(find src/app src/components -name "*.tsx" -not -path "*__tests__*" -not -name "*.test.*"); do
  if ! grep -q "useTranslations" "$f" 2>/dev/null; then
    COUNT=$(grep -c ">[A-Z][a-zA-Z ]" "$f" 2>/dev/null || echo 0)
    if [ "$COUNT" -gt 3 ]; then
      echo "  $f ($COUNT strings)"
    fi
  fi
done
```

### 6. New Keys Stub Generator

When en.json has keys missing from other locales, generate stub entries:

```bash
node -e "
const fs = require('fs');
const en = require('./messages/en.json');
const localeFiles = ['fr', 'ja'];

function getLeaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? getLeaves(v, prefix + k + '.') : [[prefix + k, v]]
  );
}

function setNested(obj, path, value) {
  const keys = path.split('.');
  let current = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;
}

const enLeaves = getLeaves(en);

for (const loc of localeFiles) {
  const data = JSON.parse(fs.readFileSync('./messages/' + loc + '.json', 'utf8'));
  const locLeaves = new Map(getLeaves(data));
  let added = 0;

  for (const [key, enVal] of enLeaves) {
    if (!locLeaves.has(key)) {
      setNested(data, key, '[NEEDS_TRANSLATION] ' + enVal);
      added++;
    }
  }

  if (added > 0) {
    fs.writeFileSync('./messages/' + loc + '.json', JSON.stringify(data, null, 2) + '\n');
    console.log(loc.toUpperCase() + ': Added ' + added + ' stub entries marked [NEEDS_TRANSLATION]');
  } else {
    console.log(loc.toUpperCase() + ': Complete - no stubs needed');
  }
}
"
```

## Output Format

Run all 6 checks and produce a summary report:

```
## Henshu Report

| Check | Status | Details |
|-------|--------|---------|
| Key Parity | PASS/FAIL | X missing in fr, Y missing in ja |
| Placeholders | PASS/FAIL | X placeholder mismatches |
| Untranslated | PASS/WARN | X possibly untranslated strings |
| Terminology | PASS/WARN | X inconsistencies |
| Wiring Coverage | XX% | Y of Z files wired |
| Stubs Generated | N/A or X added | Auto-generated stubs for missing keys |
```

If any check is FAIL, list the specific issues below the table.
If stubs were generated, note the files modified and remind to assign translation agents.
