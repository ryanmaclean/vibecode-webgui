import { BlobServiceClient, ContainerClient, BlockBlobClient } from '@azure/storage-blob'
import { QueueClient } from '@azure/storage-queue'

const uploadsContainer = process.env.STORAGE_UPLOADS_CONTAINER || 'uploads'
const queueName = process.env.STORAGE_QUEUE_NAME || 'pdf-processing'

function assertEnv(value: string | undefined, name: string): asserts value is string {
  if (!value) {
    throw new Error(`Missing required environment variable ${name}`)
  }
}

let blobServiceClient: BlobServiceClient | undefined
let queueClient: QueueClient | undefined

function getConnectionString(): string {
  const connectionString = process.env.STORAGE_ACCOUNT_CONNECTION
  assertEnv(connectionString, 'STORAGE_ACCOUNT_CONNECTION')
  return connectionString
}

function getBlobServiceClient(): BlobServiceClient {
  if (!blobServiceClient) {
    blobServiceClient = BlobServiceClient.fromConnectionString(getConnectionString())
  }
  return blobServiceClient
}

export async function getUploadsContainerClient(): Promise<ContainerClient> {
  const client = getBlobServiceClient().getContainerClient(uploadsContainer)
  await client.createIfNotExists()
  return client
}

export async function getBlockBlobClient(blobName: string): Promise<BlockBlobClient> {
  const containerClient = await getUploadsContainerClient()
  return containerClient.getBlockBlobClient(blobName)
}

export async function getQueueClient(): Promise<QueueClient> {
  if (!queueClient) {
    queueClient = new QueueClient(getConnectionString(), queueName)
  }
  await queueClient.createIfNotExists()
  return queueClient
}

export function getQueueName(): string {
  return queueName
}

export function getUploadsContainerName(): string {
  return uploadsContainer
}
