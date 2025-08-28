'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function MonitoringLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [activePage, setActivePage] = useState('connection-pool')
  
  const handleNavChange = (page: string) => {
    setActivePage(page)
    router.push(`/monitoring/${page}`)
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row md:space-x-8">
          {/* Sidebar */}
          <div className="w-full md:w-64 mb-6 md:mb-0">
            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Monitoring</h2>
              <nav className="space-y-1">
                <NavItem 
                  title="Dashboard"
                  href="/monitoring"
                  active={activePage === 'dashboard'}
                  onClick={() => handleNavChange('dashboard')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  }
                />
                <NavItem 
                  title="Connection Pool"
                  href="/monitoring/connection-pool"
                  active={activePage === 'connection-pool'}
                  onClick={() => handleNavChange('connection-pool')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
                  }
                />
                <NavItem 
                  title="Vector Database"
                  href="/monitoring/vector-db"
                  active={activePage === 'vector-db'}
                  onClick={() => handleNavChange('vector-db')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  }
                />
                <NavItem 
                  title="API Performance"
                  href="/monitoring/api-performance"
                  active={activePage === 'api-performance'}
                  onClick={() => handleNavChange('api-performance')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                <NavItem 
                  title="Logs"
                  href="/monitoring/logs"
                  active={activePage === 'logs'}
                  onClick={() => handleNavChange('logs')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
                <NavItem 
                  title="Alerts"
                  href="/monitoring/alerts"
                  active={activePage === 'alerts'}
                  onClick={() => handleNavChange('alerts')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  }
                />
                <NavItem 
                  title="Datadog Integration"
                  href="/monitoring/datadog"
                  active={activePage === 'datadog'}
                  onClick={() => handleNavChange('datadog')}
                  icon={
                    <svg className="mr-3 flex-shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  }
                />
              </nav>
            </div>
          </div>
          
          {/* Main content */}
          <div className="flex-1">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

interface NavItemProps {
  title: string
  href: string
  active: boolean
  onClick: () => void
  icon: React.ReactNode
}

const NavItem: React.FC<NavItemProps> = ({
  title,
  href,
  active,
  onClick,
  icon
}) => {
  return (
    <Link
      href={href}
      onClick={(e) => {
        e.preventDefault()
        onClick()
      }}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md ${
        active
          ? 'bg-blue-50 text-blue-700'
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
      }`}
    >
      {icon}
      {title}
    </Link>
  )
}