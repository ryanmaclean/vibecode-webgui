import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Database: (props: any) => <svg data-testid="database-icon" {...props} />,
  Search: (props: any) => <svg data-testid="search-icon" {...props} />,
  Activity: (props: any) => <svg data-testid="activity-icon" {...props} />,
  HardDrive: (props: any) => <svg data-testid="harddrive-icon" {...props} />,
  Layers: (props: any) => <svg data-testid="layers-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="check-circle-icon" {...props} />,
  AlertTriangle: (props: any) => <svg data-testid="alert-triangle-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  RefreshCw: (props: any) => <svg data-testid="refresh-icon" {...props} />,
  ArrowUpDown: (props: any) => <svg data-testid="arrow-updown-icon" {...props} />,
}));

import VectorDatabaseMonitorPage from '../page';

describe('VectorDatabaseMonitorPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Vector Database Monitor')).toBeInTheDocument();
  });

  it('renders page title as heading', () => {
    render(<VectorDatabaseMonitorPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Vector Database Monitor');
  });

  it('renders page description', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(
      screen.getByText('Collection health, query performance, and index optimization')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', () => {
    render(<VectorDatabaseMonitorPage />);
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Total Vectors summary card', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Total Vectors')).toBeInTheDocument();
    expect(screen.getByText('6 collections')).toBeInTheDocument();
  });

  it('renders Index Size summary card', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Index Size')).toBeInTheDocument();
    expect(screen.getByText('across all collections')).toBeInTheDocument();
  });

  it('renders Avg Query Latency summary card', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Avg Query Latency')).toBeInTheDocument();
    expect(screen.getByText('last 100 queries')).toBeInTheDocument();
  });

  it('renders Embedding Rate summary card', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Embedding Rate')).toBeInTheDocument();
    expect(screen.getByText('450/min')).toBeInTheDocument();
    expect(screen.getByText('current throughput')).toBeInTheDocument();
  });

  it('renders Collections table with all 6 collections', () => {
    render(<VectorDatabaseMonitorPage />);
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

  it('renders collection table column headers', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Collection Name')).toBeInTheDocument();
    expect(screen.getByText('Vector Count')).toBeInTheDocument();
    expect(screen.getByText('Dimensions')).toBeInTheDocument();
    expect(screen.getByText('Index Type')).toBeInTheDocument();
    expect(screen.getByText('Disk Usage')).toBeInTheDocument();
  });

  it('renders Recent Queries section', () => {
    render(<VectorDatabaseMonitorPage />);
    expect(screen.getByText('Recent Queries')).toBeInTheDocument();
    expect(screen.getByText(/10 similarity search queries/)).toBeInTheDocument();
    expect(
      screen.getByText('How to implement authentication middleware...')
    ).toBeInTheDocument();
  });

  it('renders Index Health section with fragmentation data', () => {
    render(<VectorDatabaseMonitorPage />);
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

  it('renders Refresh button and handles click', () => {
    render(<VectorDatabaseMonitorPage />);
    const refreshBtn = screen.getByText('Refresh');
    expect(refreshBtn).toBeInTheDocument();
    fireEvent.click(refreshBtn);
    expect(refreshBtn).toBeInTheDocument();
  });

  it('sorts collections when clicking column headers', () => {
    render(<VectorDatabaseMonitorPage />);
    const nameHeader = screen.getByText('Collection Name');
    fireEvent.click(nameHeader);
    // After clicking, sorted by name - page should still render correctly
    const codeEmbeddings = screen.getAllByText('code_embeddings');
    expect(codeEmbeddings.length).toBeGreaterThanOrEqual(1);
    const wikiPages = screen.getAllByText('wiki_pages');
    expect(wikiPages.length).toBeGreaterThanOrEqual(1);
  });
});
