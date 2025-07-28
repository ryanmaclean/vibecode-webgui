import { l as createVNode, h as Fragment, _ as __astro_tag_component__ } from './astro/server_CZ22FktV.mjs';
import { c as $$CardGrid, d as $$Card } from './Code_sG7OrJbj.mjs';
import 'clsx';

const frontmatter = {
  "title": "VibeCode Platform Documentation",
  "description": "Welcome to the VibeCode cloud-native development platform with AI-powered workflows",
  "template": "splash",
  "hero": {
    "tagline": "Cloud-Native Development Platform with AI-Powered Workflows",
    "actions": [{
      "text": "Documentation Wiki",
      "link": "/wiki-index/",
      "icon": "document",
      "variant": "primary"
    }, {
      "text": "KIND Setup Guide",
      "link": "/kind-troubleshooting/",
      "icon": "rocket",
      "variant": "secondary"
    }, {
      "text": "View on GitHub",
      "link": "https://github.com/vibecode/vibecode-webgui",
      "icon": "external",
      "variant": "minimal"
    }]
  }
};
function getHeadings() {
  return [{
    "depth": 2,
    "slug": "what-is-vibecode",
    "text": "What is VibeCode?"
  }, {
    "depth": 2,
    "slug": "key-features",
    "text": "Key Features"
  }, {
    "depth": 2,
    "slug": "architecture-overview",
    "text": "Architecture Overview"
  }, {
    "depth": 3,
    "slug": "primary-default-datadog--prometheus--vector-hybrid",
    "text": "Primary (Default): Datadog + Prometheus + Vector Hybrid"
  }, {
    "depth": 3,
    "slug": "alternative-options-permissive-licenses",
    "text": "Alternative Options (Permissive Licenses)"
  }, {
    "depth": 3,
    "slug": "security-analysis",
    "text": "Security Analysis"
  }, {
    "depth": 2,
    "slug": "quick-links",
    "text": "Quick Links"
  }];
}
function _createMdxContent(props) {
  const {Fragment: Fragment$1} = props.components || ({});
  if (!Fragment$1) _missingMdxReference("Fragment");
  return createVNode(Fragment, {
    children: [createVNode(Fragment$1, {
      "set:html": "<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"what-is-vibecode\">What is VibeCode?</h2><a class=\"sl-anchor-link\" href=\"#what-is-vibecode\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “What is VibeCode?”</span></a></div>\n<p>VibeCode is an <strong>infrastructure-first</strong> cloud-native development platform that combines the power of AI-driven project generation with enterprise-grade security and observability. Built on Kubernetes with a complete VS Code experience in the cloud.</p>\n"
    }), createVNode($$CardGrid, {
      children: [createVNode($$Card, {
        title: "🚀 AI Project Generation",
        icon: "rocket",
        "set:html": "<p>Transform natural language prompts into production-ready codebases using Claude-3.5-Sonnet and multiple AI providers.</p>"
      }), createVNode($$Card, {
        title: "🖥️ Live VS Code Experience",
        icon: "laptop",
        "set:html": "<p>Full IDE via code-server with real-time collaboration, not a limited web editor.</p>"
      }), createVNode($$Card, {
        title: "📊 Multi-Platform Observability",
        icon: "chart",
        "set:html": "<p>Hybrid monitoring stack: Datadog + Prometheus + Vector + OpenTelemetry support.</p>"
      }), createVNode($$Card, {
        title: "🔐 Enterprise Security",
        icon: "shield",
        "set:html": "<p>Authelia 2FA/SSO, hardware keys, TOTP, integrated security scanning with Kubehound.</p>"
      })]
    }), "\n", createVNode(Fragment$1, {
      "set:html": "<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"key-features\">Key Features</h2><a class=\"sl-anchor-link\" href=\"#key-features\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Key Features”</span></a></div>\n<ul>\n<li><strong>Infrastructure-First</strong>: KIND (Kubernetes in Docker) orchestration eliminates 60-80% custom development</li>\n<li><strong>Multi-AI Provider Support</strong>: Avoid vendor lock-in with intelligent routing across 6+ AI models</li>\n<li><strong>Production-Ready</strong>: NGINX Ingress, cert-manager, Helm charts, persistent storage</li>\n<li><strong>Accessibility Compliance</strong>: WCAG 2.1 AA compliant with comprehensive testing</li>\n<li><strong>Open Source</strong>: MIT license with permissive dependencies (Apache 2.0, BSD, MPL-2.0)</li>\n</ul>\n<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"architecture-overview\">Architecture Overview</h2><a class=\"sl-anchor-link\" href=\"#architecture-overview\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Architecture Overview”</span></a></div>\n<p>VibeCode leverages a <strong>hybrid observability stack</strong> that provides both enterprise features and vendor independence:</p>\n<div class=\"sl-heading-wrapper level-h3\"><h3 id=\"primary-default-datadog--prometheus--vector-hybrid\">Primary (Default): Datadog + Prometheus + Vector Hybrid</h3><a class=\"sl-anchor-link\" href=\"#primary-default-datadog--prometheus--vector-hybrid\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Primary (Default): Datadog + Prometheus + Vector Hybrid”</span></a></div>\n<ul>\n<li><strong>Datadog Agent + Cluster Agent</strong>: Full-featured SaaS platform (commercial license)</li>\n<li><strong>Prometheus</strong>: Open source metrics collection (Apache 2.0 license)</li>\n<li><strong>Vector</strong>: High-performance log/metrics router (MPL-2.0 license, by Datadog)</li>\n<li><strong>Combined Benefits</strong>: Enterprise features + vendor independence + high-performance data pipeline</li>\n</ul>\n<div class=\"sl-heading-wrapper level-h3\"><h3 id=\"alternative-options-permissive-licenses\">Alternative Options (Permissive Licenses)</h3><a class=\"sl-anchor-link\" href=\"#alternative-options-permissive-licenses\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Alternative Options (Permissive Licenses)”</span></a></div>\n<ul>\n<li><strong>OpenTelemetry Collector</strong>: Vendor-neutral telemetry (Apache 2.0 license)</li>\n<li><strong>Grafana</strong>: Visualization layer (AGPL v3 license)</li>\n<li><strong>Full Open Source Stack</strong>: Prometheus + OpenTelemetry + Vector + Grafana</li>\n</ul>\n<div class=\"sl-heading-wrapper level-h3\"><h3 id=\"security-analysis\">Security Analysis</h3><a class=\"sl-anchor-link\" href=\"#security-analysis\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Security Analysis”</span></a></div>\n<ul>\n<li><strong>Kubehound</strong>: Kubernetes attack path analysis (by Datadog, open source)</li>\n</ul>\n<div class=\"sl-heading-wrapper level-h2\"><h2 id=\"quick-links\">Quick Links</h2><a class=\"sl-anchor-link\" href=\"#quick-links\"><span aria-hidden=\"true\" class=\"sl-anchor-icon\"><svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\"><path fill=\"currentcolor\" d=\"m12.11 15.39-3.88 3.88a2.52 2.52 0 0 1-3.5 0 2.47 2.47 0 0 1 0-3.5l3.88-3.88a1 1 0 0 0-1.42-1.42l-3.88 3.89a4.48 4.48 0 0 0 6.33 6.33l3.89-3.88a1 1 0 1 0-1.42-1.42Zm8.58-12.08a4.49 4.49 0 0 0-6.33 0l-3.89 3.88a1 1 0 0 0 1.42 1.42l3.88-3.88a2.52 2.52 0 0 1 3.5 0 2.47 2.47 0 0 1 0 3.5l-3.88 3.88a1 1 0 1 0 1.42 1.42l3.88-3.89a4.49 4.49 0 0 0 0-6.33ZM8.83 15.17a1 1 0 0 0 1.1.22 1 1 0 0 0 .32-.22l4.92-4.92a1 1 0 0 0-1.42-1.42l-4.92 4.92a1 1 0 0 0 0 1.42Z\"></path></svg></span><span class=\"sr-only\">Section titled “Quick Links”</span></a></div>\n<ul>\n<li><a href=\"/wiki-index/\">📋 Documentation Wiki</a> - Complete documentation index</li>\n<li><a href=\"/kind-troubleshooting/\">🚀 KIND Setup Guide</a> - Local Kubernetes environment</li>\n<li><a href=\"/docker-troubleshooting/\">🐳 Docker Doctor</a> - Interactive Docker troubleshooting</li>\n<li><a href=\"/enhanced-ai-features/\">🤖 Enhanced AI Features</a> - Latest AI capabilities</li>\n<li><a href=\"/production-status/\">🏗️ Production Status</a> - Current deployment status</li>\n<li><a href=\"/repository-scan/\">🔧 Repository Scan</a> - Project health overview</li>\n</ul>"
    })]
  });
}
function MDXContent(props = {}) {
  const {wrapper: MDXLayout} = props.components || ({});
  return MDXLayout ? createVNode(MDXLayout, {
    ...props,
    children: createVNode(_createMdxContent, {
      ...props
    })
  }) : _createMdxContent(props);
}
function _missingMdxReference(id, component) {
  throw new Error("Expected " + ("component" ) + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.");
}

const url = "src/content/docs/index.mdx/";
const file = "/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs/index.mdx";
const Content = (props = {}) => MDXContent({
  ...props,
  components: { Fragment: Fragment, ...props.components, },
});
Content[Symbol.for('mdx-component')] = true;
Content[Symbol.for('astro.needsHeadRendering')] = !Boolean(frontmatter.layout);
Content.moduleId = "/Users/ryan.maclean/vibecode-webgui/docs/src/content/docs/index.mdx";
__astro_tag_component__(Content, 'astro:jsx');

export { Content, Content as default, file, frontmatter, getHeadings, url };
