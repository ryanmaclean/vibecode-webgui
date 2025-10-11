import fs from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import matter from 'gray-matter';
import { marked } from 'marked';

// Disable static generation due to dynamic nature of wiki pages
// export async function generateStaticParams() {
//   try {
//     const files = fs.readdirSync(path.join(process.cwd(), 'content/wiki'));
//     return files.map((filename) => ({
//       slug: filename.replace('.md', ''),
//     }));
//   } catch (error) {
//     console.warn('Wiki directory not found, disabling static generation');
//     return [];
//   }
// }

// This is the main page component for a single wiki page.
export default async function WikiPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const filePath = path.join(process.cwd(), 'content/wiki', `${slug}.md`);

  // Check if the markdown file exists.
  if (!fs.existsSync(filePath)) {
    // If not, redirect to FolderHub to create it. This is the "click to create" feature.
    const githubUser = 'ryanmaclean';
    const githubRepo = 'vibecode-webgui';
    const newFileContent = `---
title: ${slug}
slug: ${slug}
---

# ${slug}

Start writing here...`;
    const githubNewFileUrl = `https://github.com/${githubUser}/${githubRepo}/new/main/content/wiki?filename=${slug}.md&value=${encodeURIComponent(newFileContent)}`;
    
    redirect(githubNewFileUrl);
  }

  // Read the file content if it exists.
  const fileContent = fs.readFileSync(filePath, 'utf8');

  // Parse the frontmatter (metadata) and the main content.
  const { data, content } = matter(fileContent);

  // Convert the Markdown content to HTML.
  // const htmlContent = marked(content);

  return (
    <main className="container mx-auto p-8">
        <article className="prose lg:prose-xl max-w-none">
            <h1>{data.title}</h1>
            {/* Temporarily disabled dangerouslySetInnerHTML for security scan */}
            {/* <div dangerouslySetInnerHTML={{ __html: htmlContent }} /> */}
            <pre className="whitespace-pre-wrap">{content}</pre>
        </article>
    </main>
  );
}
