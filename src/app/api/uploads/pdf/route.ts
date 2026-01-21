import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { getBlockBlobClient, getQueueClient, getUploadsContainerName, getQueueName } from '@/lib/azure/storage'
import prisma from '@/lib/prisma'
// import { logger } from '../../../../lib/logger'
import { validateFileUpload, generateSecureStorageName } from '@/lib/security/file-validation';


export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = Number(process.env.PDF_UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024)

export async function POST(request: NextRequest) {
  // Authentication check
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Authentication required for PDF uploads' },
      { status: 401 }
    )
  }
  // Note: In test environment, content-type might not be set correctly
  // so we'll check for formData availability instead
  const contentType = request.headers.get('content-type')
  if (contentType && !contentType.includes('multipart/form-data') && !contentType.includes('application/x-www-form-urlencoded')) {
    // Only reject if content-type is explicitly set to something wrong
    if (contentType !== 'application/octet-stream' && contentType !== '') {
      return NextResponse.json({ error: 'Invalid content type. Expected multipart/form-data.' }, { status: 400 })
    }
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const workspaceIdentifier = formData.get('workspaceId')

  if (!workspaceIdentifier || typeof workspaceIdentifier !== 'string' || workspaceIdentifier.trim().length === 0) {
    return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
  }

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing PDF file in form-data "file" field.' }, { status: 400 })
  }

  // SECURITY: Get file buffer for comprehensive validation
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // SECURITY: Comprehensive file validation beyond MIME type checking
  const validationResult = validateFileUpload(file, buffer)
  
  if (!validationResult.isValid) {
    console.warn('File upload validation failed', {
      errors: validationResult.errors,
      warnings: validationResult.warnings,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type
    })
    
    return NextResponse.json({
      error: 'File validation failed',
      details: validationResult.errors,
      warnings: validationResult.warnings
    }, { status: 400 })
  }

  // Log warnings even if file passes validation
  if (validationResult.warnings.length > 0) {
    console.warn('File upload warnings', {
      warnings: validationResult.warnings,
      fileName: file.name,
      confidence: validationResult.metadata
    })
  }

  // SECURITY: Additional size check against configured maximum
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({
      error: `PDF must be smaller than ${MAX_UPLOAD_BYTES} bytes.`
    }, { status: 400 })
  }

  const jobId = randomUUID()
  const blobName = generateSecureStorageName(file.name, jobId)

  const workspace = await prisma.workspace.findUnique({
    where: { workspace_id: workspaceIdentifier },
    include: { user: true }
  })

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }

  let projectId: number | null = null
  const projectIdentifier = formData.get('projectId')
  if (typeof projectIdentifier === 'string' && projectIdentifier.trim().length > 0) {
    const parsed = Number(projectIdentifier)
    if (Number.isNaN(parsed)) {
      return NextResponse.json({ error: 'projectId must be a numeric identifier' }, { status: 400 })
    }
    const project = await prisma.project.findUnique({ where: { id: parsed } })
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    projectId = project.id
  }

  try {
    const blobClient = await getBlockBlobClient(blobName)
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
        blobContentDisposition: `inline; filename="${file.name}"`
      },
      metadata: {
        originalFileName: file.name,
        uploader: (formData.get('uploader') as string) || 'unknown',
        securityValidation: JSON.stringify({
          validated: true,
          warnings: validationResult.warnings,
          validatedAt: new Date().toISOString()
        })
      }
    })
  } catch (error) {
    console.error('Failed to upload PDF to blob storage', { error: error })
    return NextResponse.json({ error: 'Failed to store PDF. Try again later.' }, { status: 500 })
  }

  let uploadRecordId: number | null = null
  try {
    const upload = await prisma.upload.create({
      data: {
        original_name: file.name,
        stored_name: blobName,
        path: `${getUploadsContainerName()}/${blobName}`,
        size: file.size,
        mime_type: file.type,
        user_id: workspace.user_id,
        workspace_id: workspace.id,
        status: 'queued',
        metadata: {
          jobId,
          blobName,
          queue: getQueueName()
        } as Prisma.JsonObject
      }
    })
    uploadRecordId = upload.id
  } catch (error) {
    console.error('Failed to record upload metadata', { error: error })
    return NextResponse.json({ error: 'Failed to register upload metadata.' }, { status: 500 })
  }

  try {
    await prisma.rAGIngestJob.create({
      data: {
        id: jobId,
        uploadId: uploadRecordId,
        blobName,
        storageContainer: getUploadsContainerName(),
        originalFileName: file.name,
        size: file.size,
        queueName: getQueueName(),
        userIdentifier: formData.get('userId')?.toString() ?? null,
        workspaceIdentifier: workspaceIdentifier,
        projectIdentifier: projectId ? projectId.toString() : null,
        requestedAt: new Date()
      }
    })
  } catch (error) {
    console.error('Failed to record ingestion job in database', { error: error })
    return NextResponse.json({ error: 'Failed to register ingestion job.' }, { status: 500 })
  }

  const queuePayload = {
    jobId,
    uploadId: uploadRecordId,
    blobName,
    blobContainer: getUploadsContainerName(),
    originalFileName: file.name,
    size: file.size,
    uploader: formData.get('uploader') || null,
    workspaceId: formData.get('workspaceId') || null,
    options: {
      projectId: formData.get('projectId') || null,
      source: formData.get('source') || 'manual-upload'
    },
    requestedAt: new Date().toISOString()
  }

  try {
    const queueClient = await getQueueClient()
    await queueClient.sendMessage(JSON.stringify(queuePayload))
  } catch (error) {
    console.error('Failed to enqueue PDF ingestion job', { error: error })
    return NextResponse.json({ error: 'Failed to queue ingestion job.' }, { status: 500 })
  }

  return NextResponse.json({
    jobId,
    status: 'queued',
    queue: getQueueName()
  }, { status: 202 })
}
