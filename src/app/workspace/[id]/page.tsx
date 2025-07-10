/**
 * Workspace page for VibeCode WebGUI
 * Displays the main development environment for a specific workspace
 */

import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import WorkspaceLayout from '@/components/workspace/WorkspaceLayout'

interface WorkspacePageProps {
  params: {
    id: string
  }
}

export async function generateMetadata({ params }: WorkspacePageProps): Promise<Metadata> {
  return {
    title: `Workspace ${params.id} - VibeCode WebGUI`,
    description: `AI-powered development environment for workspace ${params.id}`,
  }
}

// Mock workspace data (replace with actual database queries)
async function getWorkspace(id: string) {
  // Simulate workspace lookup
  if (!id || id.length < 3) {
    return null
  }

  return {
    id,
    name: `Project ${id}`,
    description: 'AI-powered development project',
    owner: 'user',
    createdAt: new Date(),
    lastAccessedAt: new Date(),
  }
}

export default async function WorkspacePage({ params }: WorkspacePageProps) {
  const workspace = await getWorkspace(params.id)

  if (!workspace) {
    notFound()
  }

  return (
    <WorkspaceLayout
      workspaceId={workspace.id}
      projectName={workspace.name}
      className="h-screen"
    />
  )
}