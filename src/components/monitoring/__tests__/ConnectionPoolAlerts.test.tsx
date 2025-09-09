import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ConnectionPoolAlerts from '../ConnectionPoolAlerts'
import ConnectionPoolAlertService, { AlertSeverity, AlertType } from '@/lib/db/connection-pool-alerts'

describe('ConnectionPoolAlerts component (integration)', () => {
  const service = ConnectionPoolAlertService.getInstance()

  beforeEach(() => {
    // Ensure a deterministic baseline: stop monitoring and clear active alerts
    if (service.isMonitoring()) service.stopMonitoring()
    for (const a of service.getActiveAlerts()) {
      service.acknowledgeAlert(a.id)
      service.clearAlert(a.id)
    }
  })

  it('renders no alerts initially and toggles monitoring state', async () => {
    render(<ConnectionPoolAlerts showControls={true} />)

    expect(screen.getByText('No alerts to display')).toBeInTheDocument()

    // Start monitoring via UI
    const startBtn = screen.getByRole('button', { name: /Start Monitoring/i })
    fireEvent.click(startBtn)
    expect(service.isMonitoring()).toBe(true)

    // Stop monitoring via UI
    const stopBtn = await screen.findByRole('button', { name: /Stop Monitoring/i })
    fireEvent.click(stopBtn)
    expect(service.isMonitoring()).toBe(false)
  })

  it('renders a service alert and allows user to dismiss it', async () => {
    render(<ConnectionPoolAlerts showControls={true} />)

    // Emit a real alert via the service
    service.addAlert({
      severity: AlertSeverity.WARNING,
      type: AlertType.POOL_UTILIZATION,
      message: 'Test Utilization Alert',
      details: { currentUtilization: 85 },
    })

    // Renders alert type and message
    expect(await screen.findByText(/Pool Utilization/i)).toBeInTheDocument()
    expect(screen.getByText(/Test Utilization Alert/i)).toBeInTheDocument()

    // Dismiss the alert via UI (this will call service.clearAlert and update local state)
    const dismiss = screen.getByRole('button', { name: /Dismiss/i })
    fireEvent.click(dismiss)

    await waitFor(() => {
      expect(screen.queryByText(/Test Utilization Alert/i)).not.toBeInTheDocument()
    })
  })

  it('acknowledges an alert and shows (Acknowledged) label', async () => {
    render(<ConnectionPoolAlerts showControls={true} />)

    // Emit a real alert via the service
    service.addAlert({
      severity: AlertSeverity.WARNING,
      type: AlertType.POOL_UTILIZATION,
      message: 'Ack Test Alert',
      details: { currentUtilization: 76 },
    })

    // Ensure it renders
    expect(await screen.findByText(/Ack Test Alert/i)).toBeInTheDocument()

    // Click Acknowledge
    const acknowledge = screen.getByRole('button', { name: /Acknowledge/i })
    fireEvent.click(acknowledge)

    // Should show the acknowledged label and remove the Acknowledge button
    expect(await screen.findByText(/\(Acknowledged\)/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Acknowledge/i })).not.toBeInTheDocument()

    // Alert remains visible (user may still choose to Dismiss later)
    expect(screen.getByText(/Ack Test Alert/i)).toBeInTheDocument()
  })
})
