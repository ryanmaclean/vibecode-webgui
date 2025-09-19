export interface Document {
  pageContent: string
  metadata?: Record<string, unknown>
}

export const createDocument = (pageContent: string, metadata: Record<string, unknown> = {}): Document => ({
  pageContent,
  metadata,
})
