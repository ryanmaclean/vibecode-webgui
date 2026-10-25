import fs from 'fs';
import path from 'path';

type FeatureEntry = {
  id: number | string;  // Can be numeric ID or string identifier
  title: string;
  issue?: string;  // Optional - newer entries may not have GitHub issues
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
      // ID can be numeric or string identifier
      if (typeof entry.id === 'number') {
        expect(entry.id).toBeGreaterThan(0);
      } else {
        expect(typeof entry.id).toBe('string');
        expect(entry.id.length).toBeGreaterThan(0);
      }
      expect(entry.title).toBeTruthy();
      // Issue is optional for newer feature entries
      if (entry.issue) {
        expect(entry.issue).toMatch(/^https:\/\//);
      }
      expect(entry.status).toBeTruthy();
      expect(entry.doc).toBeTruthy();
      expect(entry.sourceRelease).toBeTruthy();

      const docPath = path.join(repoRoot, entry.doc);
      const doc = fs.readFileSync(docPath, 'utf-8');
      // Only check for TODO if status is not 'implemented'
      if (entry.status !== 'implemented') {
        expect(doc).toContain('TODO');
        expect(doc).toContain('Missing Info');
      }
    }
  });
});
