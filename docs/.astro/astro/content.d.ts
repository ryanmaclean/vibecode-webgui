declare module 'astro:content' {
	interface Render {
		'.mdx': Promise<{
			Content: import('astro').MarkdownInstance<{}>['Content'];
			headings: import('astro').MarkdownHeading[];
			remarkPluginFrontmatter: Record<string, any>;
			components: import('astro').MDXInstance<{}>['components'];
		}>;
	}
}

declare module 'astro:content' {
	interface RenderResult {
		Content: import('astro/runtime/server/index.js').AstroComponentFactory;
		headings: import('astro').MarkdownHeading[];
		remarkPluginFrontmatter: Record<string, any>;
	}
	interface Render {
		'.md': Promise<RenderResult>;
	}

	export interface RenderedContent {
		html: string;
		metadata?: {
			imagePaths: Array<string>;
			[key: string]: unknown;
		};
	}
}

declare module 'astro:content' {
	type Flatten<T> = T extends { [K: string]: infer U } ? U : never;

	export type CollectionKey = keyof AnyEntryMap;
	export type CollectionEntry<C extends CollectionKey> = Flatten<AnyEntryMap[C]>;

	export type ContentCollectionKey = keyof ContentEntryMap;
	export type DataCollectionKey = keyof DataEntryMap;

	type AllValuesOf<T> = T extends any ? T[keyof T] : never;
	type ValidContentEntrySlug<C extends keyof ContentEntryMap> = AllValuesOf<
		ContentEntryMap[C]
	>['slug'];

	/** @deprecated Use `getEntry` instead. */
	export function getEntryBySlug<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		// Note that this has to accept a regular string too, for SSR
		entrySlug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;

	/** @deprecated Use `getEntry` instead. */
	export function getDataEntryById<C extends keyof DataEntryMap, E extends keyof DataEntryMap[C]>(
		collection: C,
		entryId: E,
	): Promise<CollectionEntry<C>>;

	export function getCollection<C extends keyof AnyEntryMap, E extends CollectionEntry<C>>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => entry is E,
	): Promise<E[]>;
	export function getCollection<C extends keyof AnyEntryMap>(
		collection: C,
		filter?: (entry: CollectionEntry<C>) => unknown,
	): Promise<CollectionEntry<C>[]>;

	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(entry: {
		collection: C;
		slug: E;
	}): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(entry: {
		collection: C;
		id: E;
	}): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof ContentEntryMap,
		E extends ValidContentEntrySlug<C> | (string & {}),
	>(
		collection: C,
		slug: E,
	): E extends ValidContentEntrySlug<C>
		? Promise<CollectionEntry<C>>
		: Promise<CollectionEntry<C> | undefined>;
	export function getEntry<
		C extends keyof DataEntryMap,
		E extends keyof DataEntryMap[C] | (string & {}),
	>(
		collection: C,
		id: E,
	): E extends keyof DataEntryMap[C]
		? Promise<DataEntryMap[C][E]>
		: Promise<CollectionEntry<C> | undefined>;

	/** Resolve an array of entry references from the same collection */
	export function getEntries<C extends keyof ContentEntryMap>(
		entries: {
			collection: C;
			slug: ValidContentEntrySlug<C>;
		}[],
	): Promise<CollectionEntry<C>[]>;
	export function getEntries<C extends keyof DataEntryMap>(
		entries: {
			collection: C;
			id: keyof DataEntryMap[C];
		}[],
	): Promise<CollectionEntry<C>[]>;

	export function render<C extends keyof AnyEntryMap>(
		entry: AnyEntryMap[C][string],
	): Promise<RenderResult>;

	export function reference<C extends keyof AnyEntryMap>(
		collection: C,
	): import('astro/zod').ZodEffects<
		import('astro/zod').ZodString,
		C extends keyof ContentEntryMap
			? {
					collection: C;
					slug: ValidContentEntrySlug<C>;
				}
			: {
					collection: C;
					id: keyof DataEntryMap[C];
				}
	>;
	// Allow generic `string` to avoid excessive type errors in the config
	// if `dev` is not running to update as you edit.
	// Invalid collection names will be caught at build time.
	export function reference<C extends string>(
		collection: C,
	): import('astro/zod').ZodEffects<import('astro/zod').ZodString, never>;

	type ReturnTypeOrOriginal<T> = T extends (...args: any[]) => infer R ? R : T;
	type InferEntrySchema<C extends keyof AnyEntryMap> = import('astro/zod').infer<
		ReturnTypeOrOriginal<Required<ContentConfig['collections'][C]>['schema']>
	>;

	type ContentEntryMap = {
		"docs": {
"AI_CLI_TOOLS_IMPLEMENTATION_PLAN.md": {
	id: "AI_CLI_TOOLS_IMPLEMENTATION_PLAN.md";
  slug: "ai_cli_tools_implementation_plan";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"AI_CLI_TOOLS_IMPLEMENTATION_SUMMARY.md": {
	id: "AI_CLI_TOOLS_IMPLEMENTATION_SUMMARY.md";
  slug: "ai_cli_tools_implementation_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"AUTHENTICATION_SUMMARY.md": {
	id: "AUTHENTICATION_SUMMARY.md";
  slug: "authentication_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"AUTHENTICATION_TESTING_GUIDE.md": {
	id: "AUTHENTICATION_TESTING_GUIDE.md";
  slug: "authentication_testing_guide";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"AZURE_INFRASTRUCTURE_SUMMARY.md": {
	id: "AZURE_INFRASTRUCTURE_SUMMARY.md";
  slug: "azure_infrastructure_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"CODE_OF_CONDUCT.md": {
	id: "CODE_OF_CONDUCT.md";
  slug: "code_of_conduct";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"COMPONENT_ONBOARDING_CHECKLIST.md": {
	id: "COMPONENT_ONBOARDING_CHECKLIST.md";
  slug: "component_onboarding_checklist";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"COMPREHENSIVE_TESTING_ASSESSMENT.md": {
	id: "COMPREHENSIVE_TESTING_ASSESSMENT.md";
  slug: "comprehensive_testing_assessment";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"COMPREHENSIVE_TESTING_GUIDE.md": {
	id: "COMPREHENSIVE_TESTING_GUIDE.md";
  slug: "comprehensive_testing_guide";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"COMPREHENSIVE_TEST_REPORT.md": {
	id: "COMPREHENSIVE_TEST_REPORT.md";
  slug: "comprehensive_test_report";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"CONTAINER_MANIFEST.md": {
	id: "CONTAINER_MANIFEST.md";
  slug: "container_manifest";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DATADOG_COMPATIBILITY_SUMMARY.md": {
	id: "DATADOG_COMPATIBILITY_SUMMARY.md";
  slug: "datadog_compatibility_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DATADOG_LOCAL_DEVELOPMENT.md": {
	id: "DATADOG_LOCAL_DEVELOPMENT.md";
  slug: "datadog_local_development";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DATADOG_MONITORING_CONFIGURATION.md": {
	id: "DATADOG_MONITORING_CONFIGURATION.md";
  slug: "datadog_monitoring_configuration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DEVELOPMENT_CREDENTIALS.md": {
	id: "DEVELOPMENT_CREDENTIALS.md";
  slug: "development_credentials";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DOCKER_MODEL_RUNNER_SETUP.md": {
	id: "DOCKER_MODEL_RUNNER_SETUP.md";
  slug: "docker_model_runner_setup";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DOCKER_TROUBLESHOOTING_SUMMARY.md": {
	id: "DOCKER_TROUBLESHOOTING_SUMMARY.md";
  slug: "docker_troubleshooting_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DOCS_CONSOLIDATION_PLAN.md": {
	id: "DOCS_CONSOLIDATION_PLAN.md";
  slug: "docs_consolidation_plan";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"DOCS_DEPLOYMENT_VALIDATION.md": {
	id: "DOCS_DEPLOYMENT_VALIDATION.md";
  slug: "docs_deployment_validation";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"ENHANCED_AI_FEATURES.md": {
	id: "ENHANCED_AI_FEATURES.md";
  slug: "enhanced_ai_features";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"ENV_VARIABLES.md": {
	id: "ENV_VARIABLES.md";
  slug: "env_variables";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"GENAI_ENHANCEMENT_SUMMARY.md": {
	id: "GENAI_ENHANCEMENT_SUMMARY.md";
  slug: "genai_enhancement_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"GENAI_INTEGRATION_ARCHITECTURE.md": {
	id: "GENAI_INTEGRATION_ARCHITECTURE.md";
  slug: "genai_integration_architecture";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"KIND_TROUBLESHOOTING_GUIDE.md": {
	id: "KIND_TROUBLESHOOTING_GUIDE.md";
  slug: "kind_troubleshooting_guide";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"KIND_VALIDATION_REPORT.md": {
	id: "KIND_VALIDATION_REPORT.md";
  slug: "kind_validation_report";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"LICENSE_SWEEP_GENAI_LIBRARIES.md": {
	id: "LICENSE_SWEEP_GENAI_LIBRARIES.md";
  slug: "license_sweep_genai_libraries";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"MASTRA_INTEGRATION_GUIDE.md": {
	id: "MASTRA_INTEGRATION_GUIDE.md";
  slug: "mastra_integration_guide";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"MICROSOFT_VSCODE_EXTENSIONS_MIT_BSD.md": {
	id: "MICROSOFT_VSCODE_EXTENSIONS_MIT_BSD.md";
  slug: "microsoft_vscode_extensions_mit_bsd";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"MISSING_AI_LIBRARIES_ANALYSIS.md": {
	id: "MISSING_AI_LIBRARIES_ANALYSIS.md";
  slug: "missing_ai_libraries_analysis";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"PRECOMMIT_OPTIMIZATION_SUMMARY.md": {
	id: "PRECOMMIT_OPTIMIZATION_SUMMARY.md";
  slug: "precommit_optimization_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"PRISMA_PGVECTOR_TEST_RESULTS.md": {
	id: "PRISMA_PGVECTOR_TEST_RESULTS.md";
  slug: "prisma_pgvector_test_results";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"PRODUCTION_STATUS_REPORT.md": {
	id: "PRODUCTION_STATUS_REPORT.md";
  slug: "production_status_report";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"REDIS_VALKEY_IMPLEMENTATION_SUMMARY.md": {
	id: "REDIS_VALKEY_IMPLEMENTATION_SUMMARY.md";
  slug: "redis_valkey_implementation_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"REDIS_VALKEY_INTEGRATION_GUIDE.md": {
	id: "REDIS_VALKEY_INTEGRATION_GUIDE.md";
  slug: "redis_valkey_integration_guide";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"REPOSITORY_SCAN_REPORT_JULY_2025.md": {
	id: "REPOSITORY_SCAN_REPORT_JULY_2025.md";
  slug: "repository_scan_report_july_2025";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"TEMPORAL_GENAI_INTEGRATION.md": {
	id: "TEMPORAL_GENAI_INTEGRATION.md";
  slug: "temporal_genai_integration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"TEMPORAL_INTEGRATION_SUMMARY.md": {
	id: "TEMPORAL_INTEGRATION_SUMMARY.md";
  slug: "temporal_integration_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"TEST_INFRASTRUCTURE_SUMMARY.md": {
	id: "TEST_INFRASTRUCTURE_SUMMARY.md";
  slug: "test_infrastructure_summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"THIRD_PARTY_NOTICES_EXTENSIONS.md": {
	id: "THIRD_PARTY_NOTICES_EXTENSIONS.md";
  slug: "third_party_notices_extensions";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"TODO.md": {
	id: "TODO.md";
  slug: "todo";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"VSCODE_EXTENSION_CONFIGURATION.md": {
	id: "VSCODE_EXTENSION_CONFIGURATION.md";
  slug: "vscode_extension_configuration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"WIKI_INDEX.md": {
	id: "WIKI_INDEX.md";
  slug: "wiki_index";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"ai-cli-tools.md": {
	id: "ai-cli-tools.md";
  slug: "ai-cli-tools";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"authentication-summary.md": {
	id: "authentication-summary.md";
  slug: "authentication-summary";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"authentication-testing.md": {
	id: "authentication-testing.md";
  slug: "authentication-testing";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"azure-infrastructure.md": {
	id: "azure-infrastructure.md";
  slug: "azure-infrastructure";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"claude-prompt.md": {
	id: "claude-prompt.md";
  slug: "claude-prompt";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"code-of-conduct.md": {
	id: "code-of-conduct.md";
  slug: "code-of-conduct";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"comprehensive-testing.md": {
	id: "comprehensive-testing.md";
  slug: "comprehensive-testing";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"container-manifest.md": {
	id: "container-manifest.md";
  slug: "container-manifest";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"contributing.md": {
	id: "contributing.md";
  slug: "contributing";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"datadog-compatibility.md": {
	id: "datadog-compatibility.md";
  slug: "datadog-compatibility";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"dev-credentials.md": {
	id: "dev-credentials.md";
  slug: "dev-credentials";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"docker-model-runner.md": {
	id: "docker-model-runner.md";
  slug: "docker-model-runner";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"docker-troubleshooting.md": {
	id: "docker-troubleshooting.md";
  slug: "docker-troubleshooting";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"docs-plan.md": {
	id: "docs-plan.md";
  slug: "docs-plan";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"enhanced-ai-features.md": {
	id: "enhanced-ai-features.md";
  slug: "enhanced-ai-features";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"env-variables.md": {
	id: "env-variables.md";
  slug: "env-variables";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"genai-integration.md": {
	id: "genai-integration.md";
  slug: "genai-integration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"guides/quick-start.md": {
	id: "guides/quick-start.md";
  slug: "guides/quick-start";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"index.mdx": {
	id: "index.mdx";
  slug: "index";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".mdx"] };
"kind-troubleshooting.md": {
	id: "kind-troubleshooting.md";
  slug: "kind-troubleshooting";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"kind-validation.md": {
	id: "kind-validation.md";
  slug: "kind-validation";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"license-sweep.md": {
	id: "license-sweep.md";
  slug: "license-sweep";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"mastra-integration.md": {
	id: "mastra-integration.md";
  slug: "mastra-integration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"microsoft-extensions.md": {
	id: "microsoft-extensions.md";
  slug: "microsoft-extensions";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"missing-ai-libraries.md": {
	id: "missing-ai-libraries.md";
  slug: "missing-ai-libraries";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"monitoring/overview.md": {
	id: "monitoring/overview.md";
  slug: "monitoring/overview";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"precommit-optimization.md": {
	id: "precommit-optimization.md";
  slug: "precommit-optimization";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"prisma-pgvector.md": {
	id: "prisma-pgvector.md";
  slug: "prisma-pgvector";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"production-status.md": {
	id: "production-status.md";
  slug: "production-status";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"redis-valkey.md": {
	id: "redis-valkey.md";
  slug: "redis-valkey";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"repository-scan.md": {
	id: "repository-scan.md";
  slug: "repository-scan";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"temporal-integration.md": {
	id: "temporal-integration.md";
  slug: "temporal-integration";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"test-coverage-report.md": {
	id: "test-coverage-report.md";
  slug: "test-coverage-report";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"test-infrastructure.md": {
	id: "test-infrastructure.md";
  slug: "test-infrastructure";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"third-party-notices.md": {
	id: "third-party-notices.md";
  slug: "third-party-notices";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"vscode-extensions.md": {
	id: "vscode-extensions.md";
  slug: "vscode-extensions";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"wiki-index.md": {
	id: "wiki-index.md";
  slug: "wiki-index";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
"wiki.md": {
	id: "wiki.md";
  slug: "wiki";
  body: string;
  collection: "docs";
  data: InferEntrySchema<"docs">
} & { render(): Render[".md"] };
};

	};

	type DataEntryMap = {
		
	};

	type AnyEntryMap = ContentEntryMap & DataEntryMap;

	export type ContentConfig = typeof import("../../src/content/config.js");
}
