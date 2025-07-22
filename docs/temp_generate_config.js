const fs = require('fs');
const path = require('path');

// Scan content directory for all markdown files
const contentDir = './src/content/docs';
const files = fs.readdirSync(contentDir, { withFileTypes: true })
  .filter(dirent => dirent.isFile() && dirent.name.endsWith('.md'))
  .map(dirent => dirent.name.replace('.md', ''));

// Categorize files based on naming patterns
const categories = {
  'Getting Started': [],
  'AI & Machine Learning': [],
  'Infrastructure & Deployment': [],
  'Data & Integrations': [],
  'Security & Authentication': [],
  'Testing & Quality': [],
  'Extensions & Tools': [],
  'Configuration': [],
  'Monitoring & Operations': [],
  'Documentation': []
};

// Auto-categorize files
files.forEach(file => {
  const filename = file.toLowerCase();
  
  if (filename.includes('wiki-index') || filename.includes('quick-start') || filename.includes('guide')) {
    categories['Getting Started'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('ai') || filename.includes('ml') || filename.includes('genai') || filename.includes('model')) {
    categories['AI & Machine Learning'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('azure') || filename.includes('infrastructure') || filename.includes('deployment') || filename.includes('production') || filename.includes('container') || filename.includes('kind')) {
    categories['Infrastructure & Deployment'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('database') || filename.includes('redis') || filename.includes('temporal') || filename.includes('prisma') || filename.includes('pgvector')) {
    categories['Data & Integrations'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('auth') || filename.includes('security') || filename.includes('credentials') || filename.includes('license')) {
    categories['Security & Authentication'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('test') || filename.includes('coverage') || filename.includes('quality') || filename.includes('precommit')) {
    categories['Testing & Quality'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('extension') || filename.includes('vscode') || filename.includes('tools') || filename.includes('microsoft') || filename.includes('mastra')) {
    categories['Extensions & Tools'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('env') || filename.includes('config') || filename.includes('contributing') || filename.includes('code-of-conduct')) {
    categories['Configuration'].push({ label: formatLabel(file), link: `/${file}/` });
  } else if (filename.includes('monitoring') || filename.includes('datadog') || filename.includes('observ')) {
    categories['Monitoring & Operations'].push({ label: formatLabel(file), link: `/${file}/` });
  } else {
    categories['Documentation'].push({ label: formatLabel(file), link: `/${file}/` });
  }
});

function formatLabel(filename) {
  return filename
    .replace(/-/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());
}

// Generate sidebar configuration
const sidebar = Object.entries(categories)
  .filter(([category, items]) => items.length > 0)
  .map(([category, items]) => ({
    label: category,
    items: items.sort((a, b) => a.label.localeCompare(b.label))
  }));

console.log('Generated sidebar for', files.length, 'files');
console.log('Categories:', Object.keys(categories).filter(cat => categories[cat].length > 0));

// Write the configuration
fs.writeFileSync('./sidebar-config.json', JSON.stringify(sidebar, null, 2));
