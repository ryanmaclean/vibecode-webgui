import fs from 'fs';
import path from 'path';

type FeatureEntry = {
  id: number;
  title: string;
  issue: string;
  status: string;
  doc: string;
  sourceRelease: string;
};

describe('feature audit registry', () => {
  const repoRoot = path.resolve(__dirname, '..', '..');
  const indexPath = path.join(repoRoot, 'docs', 'feature-audit', 'index.json');

  it('lists valid feature audit entries with doc stubs', () => {
    const raw = fs.readFileSync(indexPath, 'utf-8');
    const entries = JSON.parse(raw) as FeatureEntry[];

    expect(Array.isArray(entries)).toBe(true);
    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      expect(entry.id).toBeGreaterThan(0);
      expect(entry.title).toBeTruthy();
      expect(entry.issue).toMatch(/^https:\/\//);
      expect(entry.status).toBeTruthy();
      expect(entry.doc).toBeTruthy();
      expect(entry.sourceRelease).toBeTruthy();

      const docPath = path.join(repoRoot, entry.doc);
      const doc = fs.readFileSync(docPath, 'utf-8');
      expect(doc).toContain('TODO');
      expect(doc).toContain('Missing Info');
    }
  });
});
