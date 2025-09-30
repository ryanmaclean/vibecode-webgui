'use client'

import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'

export function OnboardingCheck({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    const checkOnboarding = async () => {
      // Skip check if not authenticated or already on onboarding page
      if (status !== 'authenticated' || pathname === '/onboarding' || pathname?.startsWith('/auth')) {
        setChecked(true)
        return
      }

      try {
        const response = await fetch('/api/user/preferences')
        if (response.ok) {
          const prefs = await response.json()
          
          // Redirect to onboarding if not completed
          if (!prefs.onboardingCompleted && pathname !== '/onboarding') {
            router.push('/onboarding')
            return
          }
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      }
      
      setChecked(true)
    }

    checkOnboarding()
  }, [status, pathname, router])

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return <>{children}</>
}
