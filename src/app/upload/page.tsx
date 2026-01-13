import { FileUploadInterface } from '@/components/ai/FileUploadInterface'

export default function UploadPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">File Upload & Analysis</h1>
      <FileUploadInterface workspaceId="default" />
    </div>
  )
}
