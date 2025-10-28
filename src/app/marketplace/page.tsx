/**
 * Template marketplace page
 */

'use client'

import React from 'react'
import { MarketplacePage } from '@/components/marketplace/MarketplacePage'
import { type MarketplaceTemplate } from '@/lib/marketplace/template-marketplace'
import { useRouter } from 'next/navigation'

export default function Marketplace() {
  const router = useRouter()

  const handleStartProject = (template: MarketplaceTemplate) => {
    // Store selected template in sessionStorage for the project generator
    sessionStorage.setItem('selectedTemplate', JSON.stringify(template))

    // Redirect to main page with template parameter - use marketplaceId or fallback to id
    const templateId = template.marketplaceId || template.id
    router.push(`/?template=${templateId}`)
  }

  return (
    <MarketplacePage
      onStartProject={handleStartProject}
    />
  )
}