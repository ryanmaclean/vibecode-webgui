'use client'

import React from 'react'
import { CollaborativeWorkspace } from '@/components/workspace/CollaborativeWorkspace'

// Disable static generation for this page
export const dynamic = 'force-dynamic'

export default function CollaborativeWorkspacePage() {
  // Generate a default workspace ID for static generation
  const defaultWorkspaceId = 'default-workspace'
  
  return (
    <div className="h-screen">
      <CollaborativeWorkspace 
        workspaceId={defaultWorkspaceId}
        userId="demo-user"
        userName="Demo User"
      />
    </div>
  )
}