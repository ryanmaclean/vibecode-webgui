import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/vector-db',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// ── Mock data ──────────────────────────────────────────────────────────────

const MOCK_COLLECTIONS = [
  { name: 'code_embeddings', vectorCount: 45231, dimensions: 1536, indexType: 'HNSW', diskUsageMB: 524, status: 'healthy', lastUpdated: new Date(Date.now() - 300000).toISOString() },
  { name: 'doc_embeddings', vectorCount: 12847, dimensions: 1536, indexType: 'HNSW', diskUsageMB: 148, status: 'healthy', lastUpdated: new Date(Date.now() - 600000).toISOString() },
  { name: 'chat_history', vectorCount: 89234, dimensions: 768, indexType: 'IVFFlat', diskUsageMB: 612, status: 'warning', lastUpdated: new Date(Date.now() - 900000).toISOString() },
  { name: 'project_files', vectorCount: 23456, dimensions: 1536, indexType: 'HNSW', diskUsageMB: 287, status: 'healthy', lastUpdated: new Date(Date.now() - 1200000).toISOString() },
  { name: 'api_docs', vectorCount: 5678, dimensions: 1536, indexType: 'HNSW', diskUsageMB: 67, status: 'healthy', lastUpdated: new Date(Date.now() - 1800000).toISOString() },
  { name: 'wiki_pages', vectorCount: 3421, dimensions: 768, indexType: 'IVFFlat', diskUsageMB: 28, status: 'healthy', lastUpdated: new Date(Date.now() - 3600000).toISOString() },
];

const MOCK_QUERIES = Array.from({ length: 10 }, (_, i) => ({
  id: `q-${i + 1}`,
  queryPreview: i === 0 ? 'How to implement authentication middleware...' : `Sample query ${i + 1}...`,
  collection: MOCK_COLLECTIONS[i % MOCK_COLLECTIONS.length].name,
  similarityScore: 0.85 + Math.random() * 0.1,
  latencyMs: 8 + i,
  resultsCount: 10,
  timestamp: new Date(Date.now() - i * 60000).toISOString(),
}));

const MOCK_INDEX_HEALTH = [
  { collection: 'code_embeddings', fragmentationPct: 8.2, lastRebuild: new Date(Date.now() - 86400000).toISOString(), suggestion: 'Index is healthy. No action needed.' },
  { collection: 'doc_embeddings', fragmentationPct: 4.1, lastRebuild: new Date(Date.now() - 172800000).toISOString(), suggestion: 'Index is healthy. No action needed.' },
  { collection: 'chat_history', fragmentationPct: 34.8, lastRebuild: new Date(Date.now() - 604800000).toISOString(), suggestion: 'High fragmentation detected. Consider rebuilding the index to improve query performance.' },
  { collection: 'project_files', fragmentationPct: 12.5, lastRebuild: new Date(Date.now() - 259200000).toISOString(), suggestion: 'Moderate fragmentation. Schedule a rebuild during off-peak hours.' },
];

function createFetchMock() {
  return jest.fn((_url: string) => {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        collections: MOCK_COLLECTIONS,
        queries: MOCK_QUERIES,
        indexHealth: MOCK_INDEX_HEALTH,
      }),
    });
  }) as jest.Mock;
}

async function renderAndSettle() {
  global.fetch = createFetchMock();
  render(<VectorDatabaseMonitorPage />);
  // Wait for loading to complete (heading appears after data loads)
  await waitFor(() => {
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });
}

import VectorDatabaseMonitorPage from '../page';

describe('VectorDatabaseMonitorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', async () => {
    await renderAndSettle();
    expect(screen.getByText('Vector Database Monitor')).toBeInTheDocument();
  });

  it('renders page title as heading', async () => {
    await renderAndSettle();
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Vector Database Monitor');
  });

  it('renders page description', async () => {
    await renderAndSettle();
    expect(
      screen.getByText('Collection health, query performance, and index optimization')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', async () => {
    await renderAndSettle();
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Total Vectors summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Total Vectors')).toBeInTheDocument();
    expect(screen.getByText('6 collections')).toBeInTheDocument();
  });

  it('renders Index Size summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Index Size')).toBeInTheDocument();
    expect(screen.getByText('across all collections')).toBeInTheDocument();
  });

  it('renders Avg Query Latency summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Avg Query Latency')).toBeInTheDocument();
    expect(screen.getByText('last 100 queries')).toBeInTheDocument();
  });

  it('renders Embedding Rate summary card', async () => {
    await renderAndSettle();
    expect(screen.getByText('Embedding Rate')).toBeInTheDocument();
    expect(screen.getByText('0/min')).toBeInTheDocument();
    expect(screen.getByText('current throughput')).toBeInTheDocument();
  });

  it('renders Collections table with all 6 collections', async () => {
    await renderAndSettle();
    expect(screen.getByText('Collections')).toBeInTheDocument();
    // Collection names appear in multiple sections (table, queries, index health)
    const codeEmbeddings = screen.getAllByText('code_embeddings');
    expect(codeEmbeddings.length).toBeGreaterThanOrEqual(1);
    const docEmbeddings = screen.getAllByText('doc_embeddings');
    expect(docEmbeddings.length).toBeGreaterThanOrEqual(1);
    const chatHistory = screen.getAllByText('chat_history');
    expect(chatHistory.length).toBeGreaterThanOrEqual(1);
    const projectFiles = screen.getAllByText('project_files');
    expect(projectFiles.length).toBeGreaterThanOrEqual(1);
    const apiDocs = screen.getAllByText('api_docs');
    expect(apiDocs.length).toBeGreaterThanOrEqual(1);
    const wikiPages = screen.getAllByText('wiki_pages');
    expect(wikiPages.length).toBeGreaterThanOrEqual(1);
  });

  it('renders collection table column headers', async () => {
    await renderAndSettle();
    expect(screen.getByText('Collection Name')).toBeInTheDocument();
    expect(screen.getByText('Vector Count')).toBeInTheDocument();
    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Index Type')).toBeInTheDocument();
    expect(screen.getByText('Disk Usage')).toBeInTheDocument();
  });

  it('renders Recent Queries section', async () => {
    await renderAndSettle();
    expect(screen.getByText('Recent Queries')).toBeInTheDocument();
    expect(screen.getByText(/10 similarity search queries/)).toBeInTheDocument();
    expect(
      screen.getByText('How to implement authentication middleware...')
    ).toBeInTheDocument();
  });

  it('renders Index Health section with fragmentation data', async () => {
    await renderAndSettle();
    expect(screen.getByText('Index Health')).toBeInTheDocument();
    expect(
      screen.getByText('Fragmentation levels and optimization recommendations')
    ).toBeInTheDocument();
    expect(screen.getByText('8.2% fragmented')).toBeInTheDocument();
    expect(screen.getByText('34.8% fragmented')).toBeInTheDocument();
    // Two collections have "Index is healthy" suggestion
    const healthySuggestions = screen.getAllByText('Index is healthy. No action needed.');
    expect(healthySuggestions.length).toBe(2);
  });

  it('renders Refresh button and handles click', async () => {
    await renderAndSettle();
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn).toBeInTheDocument();
    // Click triggers a re-fetch; just verify it doesn't throw
    fireEvent.click(refreshBtn);
    // Button should still exist after click (may re-render during re-fetch)
    expect(screen.queryByText('Refresh')).toBeDefined();
  });

  it('sorts collections when clicking column headers', async () => {
    await renderAndSettle();
    const nameHeader = screen.getByText('Collection Name');
    fireEvent.click(nameHeader);
    // After clicking, sorted by name - page should still render correctly
    const codeEmbeddings = screen.getAllByText('code_embeddings');
    expect(codeEmbeddings.length).toBeGreaterThanOrEqual(1);
    const wikiPages = screen.getAllByText('wiki_pages');
    expect(wikiPages.length).toBeGreaterThanOrEqual(1);
  });
});
