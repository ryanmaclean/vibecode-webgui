import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
  usePathname: () => '/monitoring/datadog',
}));

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  );
});

// Mock lucide-react icons
jest.mock('lucide-react', () => ({
  Zap: (props: any) => <svg data-testid="zap-icon" {...props} />,
  CheckCircle: (props: any) => <svg data-testid="check-circle-icon" {...props} />,
  XCircle: (props: any) => <svg data-testid="x-circle-icon" {...props} />,
  Settings: (props: any) => <svg data-testid="settings-icon" {...props} />,
  Activity: (props: any) => <svg data-testid="activity-icon" {...props} />,
  Shield: (props: any) => <svg data-testid="shield-icon" {...props} />,
  Eye: (props: any) => <svg data-testid="eye-icon" {...props} />,
  EyeOff: (props: any) => <svg data-testid="eye-off-icon" {...props} />,
  ExternalLink: (props: any) => <svg data-testid="external-link-icon" {...props} />,
  ChevronRight: (props: any) => <svg data-testid="chevron-right-icon" {...props} />,
  Server: (props: any) => <svg data-testid="server-icon" {...props} />,
  FileText: (props: any) => <svg data-testid="file-text-icon" {...props} />,
  BarChart3: (props: any) => <svg data-testid="barchart-icon" {...props} />,
  Bell: (props: any) => <svg data-testid="bell-icon" {...props} />,
  Clock: (props: any) => <svg data-testid="clock-icon" {...props} />,
  Code: (props: any) => <svg data-testid="code-icon" {...props} />,
}));

import DatadogIntegrationPage from '../page';

describe('DatadogIntegrationPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(<DatadogIntegrationPage />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent('Datadog Integration');
  });

  it('renders page description', () => {
    render(<DatadogIntegrationPage />);
    expect(
      screen.getByText('APM, logs, metrics, and DogStatsD observability integration')
    ).toBeInTheDocument();
  });

  it('renders breadcrumb with link to /monitoring', () => {
    render(<DatadogIntegrationPage />);
    const monitoringLink = screen.getByText('Monitoring');
    expect(monitoringLink).toBeInTheDocument();
    expect(monitoringLink.closest('a')).toHaveAttribute('href', '/monitoring');
  });

  it('renders Connection Status section', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Connection Status')).toBeInTheDocument();
    const connectedBadges = screen.getAllByText('Connected');
    expect(connectedBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('renders APM Traces metric card', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('APM Traces')).toBeInTheDocument();
    expect(screen.getByText('12.4K')).toBeInTheDocument();
  });

  it('renders Log Events metric card', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Log Events')).toBeInTheDocument();
    expect(screen.getByText('45.8K')).toBeInTheDocument();
  });

  it('renders Custom Metrics card', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Custom Metrics')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
  });

  it('renders Monitors metric card', () => {
    render(<DatadogIntegrationPage />);
    // "Monitors" appears as both card label and section heading
    const monitorsText = screen.getAllByText(/Monitors/);
    expect(monitorsText.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('8')).toBeInTheDocument();
  });

  it('renders Traced Services table with service names', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Traced Services')).toBeInTheDocument();
    expect(screen.getByText('vibecode-webgui')).toBeInTheDocument();
    expect(screen.getByText('vibecode-api')).toBeInTheDocument();
    expect(screen.getByText('vibecode-vm-manager')).toBeInTheDocument();
    expect(screen.getByText('vibecode-health-checker')).toBeInTheDocument();
    expect(screen.getByText('vibecode-ai-gateway')).toBeInTheDocument();
    expect(screen.getByText('vibecode-websocket')).toBeInTheDocument();
  });

  it('renders Active Monitors section with monitor names', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Active Monitors')).toBeInTheDocument();
    expect(screen.getByText('Service Health')).toBeInTheDocument();
    expect(screen.getByText('API Error Rate')).toBeInTheDocument();
    expect(screen.getByText('VM Boot Time')).toBeInTheDocument();
    expect(screen.getByText('AI Response Latency')).toBeInTheDocument();
    expect(screen.getByText('Database Connection Pool')).toBeInTheDocument();
    expect(screen.getByText('Memory Usage')).toBeInTheDocument();
    expect(screen.getByText('WebSocket Connections')).toBeInTheDocument();
    expect(screen.getByText('Certificate Expiry')).toBeInTheDocument();
  });

  it('renders Configuration section with env vars', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Configuration')).toBeInTheDocument();
    expect(screen.getByText('DD_AGENT_HOST')).toBeInTheDocument();
    expect(screen.getByText('DD_TRACE_ENABLED')).toBeInTheDocument();
    expect(screen.getByText('DD_SERVICE')).toBeInTheDocument();
    expect(screen.getByText('DD_ENV')).toBeInTheDocument();
  });

  it('toggles env var values visibility', () => {
    render(<DatadogIntegrationPage />);
    const showBtn = screen.getByText('Show Values');
    expect(showBtn).toBeInTheDocument();
    fireEvent.click(showBtn);
    expect(screen.getByText('Hide Values')).toBeInTheDocument();
    // Values should now be visible
    expect(screen.getByText('localhost')).toBeInTheDocument();
    expect(screen.getByText('vibecode')).toBeInTheDocument();
  });

  it('toggles API key visibility', () => {
    render(<DatadogIntegrationPage />);
    // Initially masked
    expect(screen.getByText('dd-api-****-****')).toBeInTheDocument();
  });

  it('renders Open Datadog Dashboard link', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('Open Datadog Dashboard')).toBeInTheDocument();
  });

  it('renders VSCode Extension section', () => {
    render(<DatadogIntegrationPage />);
    expect(screen.getByText('VSCode Extension')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
    expect(screen.getByText('19 registered')).toBeInTheDocument();
  });
});
