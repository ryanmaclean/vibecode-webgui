Creating a Wiki using Astro v5 and Markdown is a great way to build a performant, static site that’s easy to manage. In this guide, I'll walk you through how to:

    Set up an Astro v5 project.

    Use Markdown files to create content.

    Dynamically generate pages from Markdown.

    Implement navigation with “click to create” functionality (for example, linking to a non-existent wiki page and being prompted to create it).

🔧 1. Set Up the Astro Project

bash
# create a new Astro project
npm create astro@latest

# Choose "Minimal" template and name your project
cd your-wiki-project
npm install

📁 2. Project Structure

Here's the file structure we'll be using:

text
/src
  /pages
    /wiki
      [slug].astro        // Dynamic wiki page
/content
  /wiki
    home.md
/public
  /assets                 // images or static files
/src/layouts
  WikiLayout.astro

📄 3. Add Markdown Content

Create Markdown files inside /content/wiki/

Example: /content/wiki/home.md

text
---
title: Home
slug: home
---

# Welcome to the Wiki

This is the home page of your wiki. You can create new pages by clicking on red links!

💡 4. Install Required Astro Integrations

Install Astro’s content collection and Markdown support:

bash
npm install @astrojs/mdx @astrojs/content

In astro.config.mjs:

js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import content from '@astrojs/content';

export default defineConfig({
  integrations: [mdx(), content()],
});

📂 5. Define the Collection Schema

Create src/content/config.ts:

ts
import { z, defineCollection } from "astro:content";

const wiki = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    slug: z.string(),
  }),
});

export const collections = {
  wiki,
};

🧠 6. Create Dynamic Wiki Page (src/pages/wiki/[slug].astro)

text
---
import WikiLayout from '../../layouts/WikiLayout.astro';
import { getCollection } from 'astro:content';
import { AstroError } from 'astro/errors';
import { Markdown } from 'astro/components';

const { slug } = Astro.params;
const pages = await getCollection('wiki');
const page = pages.find(p => p.data.slug === slug);

if (!page) {
  throw Astro.redirect(`/wiki/new?slug=${encodeURIComponent(slug)}`);
}
---

<WikiLayout title={page.data.title}>
  <Markdown content={page.body} />
</WikiLayout>

🧾 7. Wiki Layout UI (src/layouts/WikiLayout.astro)

text
---
const { title } = Astro.props;
---

<html lang="en">
  <head>
    <title>{title}</title>
  </head>
  <body>
    <header>
      <h1><a href="/wiki/home">Wiki</a></h1>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>

🆕 8. Create New Page UI (src/pages/wiki/new.astro)

text
---
const { slug } = Astro.url.searchParams;
---

<html lang="en">
  <head>
    <title>Create Page</title>
  </head>
  <body>
    <h1>Create New Wiki Page</h1>
    <p>This page does not exist yet.</p>
    <form method="GET" action="https://github.com/YOUR_USERNAME/YOUR_REPO/new/main/content/wiki">
      <input type="hidden" name="filename" value={`${slug}.md`} />
      <label>
        Title: <input type="text" name="value" value={`---\ntitle: ${slug}\nslug: ${slug}\n---\n\n# ${slug}\n\nStart writing here...`} />
      </label>
      <button type="submit">Create on GitHub</button>
    </form>
  </body>
</html>

➡️ Replace the form action with a GitHub "create file" URL like this:

xml
<a href="https://github.com/YOUR_USERNAME/YOUR_REPO/new/main/content/wiki?filename=${slug}.md&value=---%0Atitle%3A%20${slug}%0Aslug%3A%20${slug}%0A---%0A%0A#%20${slug}%0A%0AStart%20writing%20here..." target="_blank">
  Create Page on GitHub
</a>

✅ 9. Linking Between Pages (with “Click to Create” Style)

In your markdown files, use this syntax for links:

text
[Some Page](/wiki/some-page)

If some-page.md does not exist, it will route to /wiki/new?slug=some-page, prompting a page creation.

You can also add styles to show “red” links if a page is missing, using a custom WikiLink component — optional enhancement.
🚀 10. Run the Wiki

bash
npm run dev

Visit http://localhost:4321/wiki/home

Try creating a new link in the markdown like [New Page](/wiki/my-new-page) — visiting this link will prompt the creation of that page.
✅ Summary

    Markdown files are stored in /content/wiki.

    Dynamic routing loads pages by slug.

    Missing pages route to a “create” prompt.

    “Click to create” links take users to GitHub’s interface to add content.

Would you like me to generate a template GitHub repo for this setup?
yes
You ran out of Pro search
Upgrade to Perplexity Pro to increase your daily limit
yes
Astro Wiki Template GitHub Repo

Great! Below is a guideline for a GitHub-ready template for your Astro v5 Markdown wiki with “click to create” support. Follow these steps to set up your repository:
📁 Folder Structure

text
/content/wiki/          # Markdown wiki pages here
/src/pages/wiki/        # Dynamic and new page components
/src/layouts/           # Wiki layout file
/src/content/           # Content collection config
astro.config.mjs        # Astro config with required integrations

✅ Steps to Set Up

    Create the repository — Use GitHub to create a new repo, for example astro-markdown-wiki.

    Initialize Astro — Run:

bash
npm create astro@latest
cd astro-markdown-wiki
npm install

Install Integrations:

bash
npm install @astrojs/content @astrojs/mdx

Configure astro.config.mjs:

js
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import content from '@astrojs/content';

export default defineConfig({
  integrations: [mdx(), content()],
});

Add Content Collection Schema (src/content/config.ts):

ts
import { z, defineCollection } from "astro:content";

const wiki = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    slug: z.string(),
  }),
});

export const collections = {
  wiki,
};

Create Dynamic Page (src/pages/wiki/[slug].astro):

text
---
import WikiLayout from '../../layouts/WikiLayout.astro';
import { getCollection } from 'astro:content';
import { AstroError } from 'astro/errors';
import { Markdown } from 'astro/components';

const { slug } = Astro.params;
const pages = await getCollection('wiki');
const page = pages.find(p => p.data.slug === slug);

if (!page) {
  throw Astro.redirect(`/wiki/new?slug=${encodeURIComponent(slug)}`);
}
---

<WikiLayout title={page.data.title}>
  <Markdown content={page.body} />
</WikiLayout>

Create the “New Page” Prompt (src/pages/wiki/new.astro):

text
---
const { slug } = Astro.url.searchParams;
const githubUser = "YOUR_USERNAME";
const githubRepo = "YOUR_REPO";
const githubNewFileUrl = `https://github.com/${githubUser}/${githubRepo}/new/main/content/wiki?filename=${slug}.md&value=---%0Atitle%3A%20${slug}%0Aslug%3A%20${slug}%0A---%0A%0A#%20${slug}%0A%0AStart%20writing%20here...`;
---

<html lang="en">
  <head>
    <title>Create Page</title>
  </head>
  <body>
    <h1>Create New Wiki Page</h1>
    <p>This page does not exist yet.</p>
    <a href={githubNewFileUrl} target="_blank">Create Page on GitHub</a>
  </body>
</html>

Replace YOUR_USERNAME and YOUR_REPO appropriately.

Add Wiki Layout (src/layouts/WikiLayout.astro):

text
---
const { title } = Astro.props;
---

<html lang="en">
  <head>
    <title>{title}</title>
  </head>
  <body>
    <header>
      <h1><a href="/wiki/home">Wiki</a></h1>
    </header>
    <main>
      <slot />
    </main>
  </body>
</html>

Add Sample Markdown Page (/content/wiki/home.md):

    text
    ---
    title: Home
    slug: home
    ---

    # Welcome to the Wiki

    This is the home page. Try creating a [New Page](/wiki/sample-page)!

🎯 Features Recap

    Markdown-based content in /content/wiki

    Dynamic routing with auto-create page prompt for missing pages

    Integration with GitHub for “click to create” new pages

    Simple and clear layout, easy navigation

🚀 Next Steps

    Commit and push your project to GitHub.

    Share the repo with your collaborators or make it public for open wiki contributions.

    Improve: Consider adding a WikiLink component to style broken links or enhance navigation.

Let me know if you want a downloadable .zip starter kit or more advanced automation for the WikiLink detection!