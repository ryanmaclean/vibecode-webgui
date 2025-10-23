import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { Prisma } from '@prisma/client'
import { getBlockBlobClient, getQueueClient, getUploadsContainerName, getQueueName } from '@/lib/azure/storage'
import prisma from '@/lib/prisma'
// import { logger } from '../../../../lib/logger';


export const dynamic = 'force-dynamic'

const MAX_UPLOAD_BYTES = Number(process.env.PDF_UPLOAD_MAX_BYTES ?? 25 * 1024 * 1024)

export async function POST(request: NextRequest) {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Invalid content type. Expected multipart/form-data.' }, { status: 400 })
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

  // Security validation: Strict MIME type check
  if (file.type !== 'application/pdf') {
    return NextResponse.json({ error: 'Only application/pdf uploads are supported.' }, { status: 415 })
  }

  // Security validation: Filename sanitization (prevent directory traversal)
  if (file.name.includes('..') || file.name.includes('/') || file.name.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename format' }, { status: 400 })
  }

  // Security validation: File extension check
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'File must have .pdf extension' }, { status: 400 })
  }

  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({
      error: `PDF must be between 1 byte and ${MAX_UPLOAD_BYTES} bytes.`
    }, { status: 400 })
  }

  const jobId = randomUUID()
  const blobName = `${jobId}.pdf`

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

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  try {
    const blobClient = await getBlockBlobClient(blobName)
    await blobClient.uploadData(buffer, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
        blobContentDisposition: `inline; filename="${file.name}"`
      },
      metadata: {
        originalFileName: file.name,
        uploader: (formData.get('uploader') as string) || 'unknown'
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
