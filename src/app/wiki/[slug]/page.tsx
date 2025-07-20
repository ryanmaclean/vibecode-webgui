import fs from 'fs';
import path from 'path';
import { redirect } from 'next/navigation';
import matter from 'gray-matter';
import { marked } from 'marked';

// This function generates static paths for all wiki pages at build time for better performance.
export async function generateStaticParams() {
  const files = fs.readdirSync(path.join(process.cwd(), 'content/wiki'));
  return files.map((filename) => ({
    slug: filename.replace('.md', ''),
  }));
}

// This is the main page component for a single wiki page.
export default function WikiPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const filePath = path.join(process.cwd(), 'content/wiki', `${slug}.md`);

  // Check if the markdown file exists.
  if (!fs.existsSync(filePath)) {
    // If not, redirect to GitHub to create it. This is the "click to create" feature.
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
  const htmlContent = marked(content);

  return (
    <main className="container mx-auto p-8">
        <article className="prose lg:prose-xl max-w-none">
            <h1>{data.title}</h1>
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </article>
    </main>
  );
}
