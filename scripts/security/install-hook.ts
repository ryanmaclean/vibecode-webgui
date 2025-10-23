import { execSync } from 'child_process';
import { chmodSync, existsSync } from 'fs';
import path from 'path';

const repoRoot = path.resolve(__dirname, '..', '..');
const huskyDir = path.join(repoRoot, '.husky');
const preCommitHook = path.join(huskyDir, 'pre-commit');

function run(command: string) {
  execSync(command, { stdio: 'inherit', cwd: repoRoot, env: process.env });
}

console.log('🔐 Setting up security pre-commit hooks (npm run security:install-hook)...');

if (!existsSync(huskyDir)) {
  console.log('📁 Husky directory missing; installing husky hooks.');
  run('npx husky install');
} else {
  run('npx husky install');
}

if (existsSync(preCommitHook)) {
  try {
    chmodSync(preCommitHook, 0o755);
  } catch (error) {
    console.warn('⚠️ Unable to chmod pre-commit hook:', (error as Error).message);
  }
} else {
  console.warn('⚠️ Husky pre-commit hook not found; ensure husky is set up.');
}

console.log('✅ Security pre-commit hook ready.');
console.log('ℹ️  (Optional) Run ./scripts/optimize-precommit.sh enable to switch to the optimized flow.');
