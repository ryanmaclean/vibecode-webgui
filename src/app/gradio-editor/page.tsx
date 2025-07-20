import { promises as fs } from 'fs';
import path from 'path';
import { FileText } from 'lucide-react';

import { GradioEditor } from '@/components/editors/gradio-editor';

// Helper function to get the path to the template file
const getTemplatePath = () => {
  // Assumes the process is running from the root of the project
  return path.join(process.cwd(), 'templates', 'python', 'basic-gradio-app', 'app.py');
};

// This is a Next.js Server Component
export default async function GradioEditorPage() {
  let initialCode = '';
  try {
    const templatePath = getTemplatePath();
    initialCode = await fs.readFile(templatePath, 'utf-8');
  } catch (error) {
    console.error('Failed to load Gradio template:', error);
    initialCode = `# Failed to load template.\n# Please check the server logs.\n\nimport gradio as gr\n\ndef greet(name):\n    return "Hello, " + name + "!"\n\niface = gr.Interface(fn=greet, inputs=\"text\", outputs=\"text\")\niface.launch()`;
  }

  return (
    <div className="flex h-screen w-full flex-col bg-background">
        <header className="flex h-14 items-center gap-4 border-b bg-muted/40 px-6">
            <FileText className="h-6 w-6" />
            <h1 className="text-lg font-semibold">Gradio Space Editor</h1>
        </header>
        <main className="flex-1">
            <GradioEditor initialCode={initialCode} />
        </main>
    </div>
  );
}
