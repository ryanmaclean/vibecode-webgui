import DocSearch from '@/components/DocSearch';

export default function DocsSearchPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            VibeCode Documentation Search
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Search through our comprehensive documentation covering deployment, testing, 
            AI integration, Kubernetes, security, and more. Over 246 documents indexed 
            with 181,547 words of content.
          </p>
        </div>
        
        <DocSearch />
        
        <div className="mt-12 bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Search Tips
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Search Techniques
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• Use specific keywords like "deployment", "testing", "kubernetes"</li>
                <li>• Combine terms: "production deployment guide"</li>
                <li>• Filter by category for focused results</li>
                <li>• Search headings and content are both indexed</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                Available Categories
              </h3>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li>• <strong>Deployment:</strong> Production guides, Helm, GitOps</li>
                <li>• <strong>Testing:</strong> Strategies, E2E, Unit tests</li>
                <li>• <strong>AI Integration:</strong> GenAI, embeddings, models</li>
                <li>• <strong>Kubernetes:</strong> KIND, secrets, monitoring</li>
                <li>• <strong>Security:</strong> Assessments, compliance</li>
                <li>• <strong>MCP Framework:</strong> Context7, Playwright, Serena</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const metadata = {
  title: 'Documentation Search - VibeCode Platform',
  description: 'Search through comprehensive VibeCode platform documentation covering deployment, testing, AI integration, and more.',
};
