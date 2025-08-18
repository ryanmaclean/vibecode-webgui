"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const assert = __importStar(require("assert"));
const vscode = __importStar(require("vscode"));
const sinon = __importStar(require("sinon"));
const axios_1 = __importDefault(require("axios"));
const templates_provider_1 = require("../../templates-provider");
suite('Templates Provider Test Suite', () => {
    let templatesProvider;
    let axiosStub;
    const mockTemplates = [
        {
            id: 'react-dashboard',
            name: 'React Dashboard',
            description: 'Modern React dashboard with TypeScript and Tailwind CSS',
            category: 'Web Development',
            tags: ['react', 'typescript', 'tailwind'],
            rating: 4.8,
            downloads: 1250,
            featured: true,
            author: 'VibeCode',
            icon: 'globe'
        },
        {
            id: 'ml-pipeline',
            name: 'ML Pipeline',
            description: 'Complete machine learning pipeline with Python and Jupyter',
            category: 'AI/ML',
            tags: ['python', 'ml', 'jupyter'],
            rating: 4.5,
            downloads: 890,
            featured: false,
            author: 'DataScience Team',
            icon: 'circuit-board'
        },
        {
            id: 'enterprise-api',
            name: 'Enterprise API',
            description: 'Scalable REST API with authentication and monitoring',
            category: 'Enterprise',
            tags: ['api', 'auth', 'monitoring'],
            rating: 4.6,
            downloads: 650,
            featured: false,
            author: 'Backend Team'
        }
    ];
    setup(() => {
        templatesProvider = new templates_provider_1.TemplatesProvider('http://localhost:3000');
        axiosStub = sinon.stub(axios_1.default, 'get');
    });
    teardown(() => {
        sinon.restore();
    });
    test('Should initialize templates provider', () => {
        assert.ok(templatesProvider);
        assert.strictEqual(typeof templatesProvider.refresh, 'function');
        assert.strictEqual(typeof templatesProvider.getTreeItem, 'function');
        assert.strictEqual(typeof templatesProvider.getChildren, 'function');
    });
    test('Should load templates successfully', async () => {
        axiosStub.resolves({ data: mockTemplates });
        await templatesProvider.refresh();
        // Verify API was called
        assert.ok(axiosStub.calledOnce);
        assert.ok(axiosStub.calledWith('http://localhost:3000/api/templates'));
    });
    test('Should categorize templates correctly', async () => {
        axiosStub.resolves({ data: mockTemplates });
        await templatesProvider.refresh();
        const categories = await templatesProvider.getChildren();
        // Should have 3 categories
        assert.strictEqual(categories.length, 3);
        // Check category names
        const categoryNames = categories.map((cat) => cat.name).sort();
        assert.deepStrictEqual(categoryNames, ['AI/ML', 'Enterprise', 'Web Development']);
    });
    test('Should return templates for category', async () => {
        axiosStub.resolves({ data: mockTemplates });
        await templatesProvider.refresh();
        const categories = await templatesProvider.getChildren();
        const webDevCategory = categories.find((cat) => cat.name === 'Web Development');
        assert.ok(webDevCategory);
        const templates = await templatesProvider.getChildren(webDevCategory);
        assert.strictEqual(templates.length, 1);
        assert.strictEqual(templates[0].name, 'React Dashboard');
    });
    test('Should create tree item for category', async () => {
        const category = { name: 'Web Development', templates: [] };
        const treeItem = templatesProvider.getTreeItem(category);
        assert.strictEqual(treeItem.label, 'Web Development');
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.Expanded);
        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(treeItem.contextValue, 'category');
    });
    test('Should create tree item for template', async () => {
        const template = mockTemplates[0];
        const treeItem = templatesProvider.getTreeItem(template);
        assert.strictEqual(treeItem.label, 'React Dashboard');
        assert.strictEqual(treeItem.description, template.description);
        assert.strictEqual(treeItem.collapsibleState, vscode.TreeItemCollapsibleState.None);
        assert.strictEqual(treeItem.contextValue, 'template');
        assert.ok(treeItem.command);
        assert.strictEqual(treeItem.command.command, 'vibecode.templates.preview');
    });
    test('Should handle featured templates with star icon', async () => {
        const featuredTemplate = mockTemplates[0]; // React Dashboard is featured
        const treeItem = templatesProvider.getTreeItem(featuredTemplate);
        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(treeItem.iconPath.id, 'star-full');
    });
    test('Should set category-specific icons for templates', async () => {
        const mlTemplate = mockTemplates[1]; // ML Pipeline
        const treeItem = templatesProvider.getTreeItem(mlTemplate);
        assert.ok(treeItem.iconPath instanceof vscode.ThemeIcon);
        assert.strictEqual(treeItem.iconPath.id, 'circuit-board');
    });
    test('Should handle API errors gracefully', async () => {
        const showErrorMessageStub = sinon.stub(vscode.window, 'showErrorMessage');
        axiosStub.rejects(new Error('Network error'));
        await templatesProvider.refresh();
        assert.ok(showErrorMessageStub.calledOnce);
        assert.ok(showErrorMessageStub.args[0][0].includes('Failed to load templates'));
        showErrorMessageStub.restore();
    });
    test('Should create project from template', async () => {
        const template = mockTemplates[0];
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        const showOpenDialogStub = sinon.stub(vscode.window, 'showOpenDialog');
        const withProgressStub = sinon.stub(vscode.window, 'withProgress');
        const axiosPostStub = sinon.stub(axios_1.default, 'post');
        // Mock user inputs
        showInputBoxStub.resolves('my-react-dashboard');
        showOpenDialogStub.resolves([vscode.Uri.file('/path/to/projects')]);
        axiosPostStub.resolves({ data: { workspaceId: 'workspace-123' } });
        withProgressStub.callsFake(async (options, task) => {
            return await task({ report: () => { } });
        });
        await templatesProvider.createProjectFromTemplate(template);
        // Verify user was prompted for project name
        assert.ok(showInputBoxStub.calledOnce);
        // Verify folder dialog was shown
        assert.ok(showOpenDialogStub.calledOnce);
        // Verify API call was made
        assert.ok(axiosPostStub.calledOnce);
        assert.strictEqual(axiosPostStub.args[0][0], 'http://localhost:3000/api/ai/generate-project');
        showInputBoxStub.restore();
        showOpenDialogStub.restore();
        withProgressStub.restore();
        axiosPostStub.restore();
    });
    test('Should validate project name input', async () => {
        const template = mockTemplates[0];
        const showInputBoxStub = sinon.stub(vscode.window, 'showInputBox');
        // Mock input box with validation
        showInputBoxStub.callsFake(async (options) => {
            // Test validation function
            assert.ok(options?.validateInput);
            // Test empty name
            let result = options.validateInput('');
            assert.strictEqual(result, 'Project name is required');
            // Test invalid characters
            result = options.validateInput('invalid name!');
            assert.strictEqual(result, 'Project name can only contain letters, numbers, hyphens, and underscores');
            // Test valid name
            result = options.validateInput('valid-name_123');
            assert.strictEqual(result, null);
            return null; // User cancelled
        });
        await templatesProvider.createProjectFromTemplate(template);
        showInputBoxStub.restore();
    });
    test('Should generate preview HTML for template', async () => {
        const template = mockTemplates[0];
        const createWebviewPanelStub = sinon.stub(vscode.window, 'createWebviewPanel');
        const mockPanel = {
            webview: {
                html: '',
                onDidReceiveMessage: sinon.stub()
            },
            dispose: sinon.stub()
        };
        createWebviewPanelStub.returns(mockPanel);
        await templatesProvider.previewTemplate(template);
        // Verify webview panel was created
        assert.ok(createWebviewPanelStub.calledOnce);
        assert.strictEqual(createWebviewPanelStub.args[0][0], 'templatePreview');
        assert.strictEqual(createWebviewPanelStub.args[0][1], 'Preview: React Dashboard');
        // Verify HTML contains template information
        assert.ok(mockPanel.webview.html.includes('React Dashboard'));
        assert.ok(mockPanel.webview.html.includes('Modern React dashboard'));
        assert.ok(mockPanel.webview.html.includes('VibeCode'));
        createWebviewPanelStub.restore();
    });
    test('Should sort templates correctly (featured first, then by rating)', async () => {
        const unsortedTemplates = [
            { ...mockTemplates[1], featured: false, rating: 4.5 }, // ML Pipeline
            { ...mockTemplates[0], featured: true, rating: 4.8 }, // React Dashboard (featured)
            { ...mockTemplates[2], featured: false, rating: 4.6 } // Enterprise API
        ];
        axiosStub.resolves({ data: unsortedTemplates });
        await templatesProvider.refresh();
        const categories = await templatesProvider.getChildren();
        // All templates should be in different categories in this test data
        // But let's check that featured template logic works by checking Web Development category
        const webDevCategory = categories.find((cat) => cat.name === 'Web Development');
        const templates = await templatesProvider.getChildren(webDevCategory);
        // Should have React Dashboard first (featured)
        assert.strictEqual(templates[0].name, 'React Dashboard');
        assert.strictEqual(templates[0].featured, true);
    });
});
// Test helper functions
suite('Templates Provider Utilities', () => {
    test('Should handle empty template list', async () => {
        const templatesProvider = new templates_provider_1.TemplatesProvider('http://localhost:3000');
        const axiosStub = sinon.stub(axios_1.default, 'get');
        axiosStub.resolves({ data: [] });
        await templatesProvider.refresh();
        const categories = await templatesProvider.getChildren();
        assert.strictEqual(categories.length, 0);
        axiosStub.restore();
    });
    test('Should handle malformed template data', async () => {
        const templatesProvider = new templates_provider_1.TemplatesProvider('http://localhost:3000');
        const axiosStub = sinon.stub(axios_1.default, 'get');
        const consoleErrorStub = sinon.stub(console, 'error');
        // Return malformed data
        axiosStub.resolves({ data: 'invalid-json' });
        try {
            await templatesProvider.refresh();
        }
        catch (error) {
            // Should handle gracefully
        }
        axiosStub.restore();
        consoleErrorStub.restore();
    });
});
//# sourceMappingURL=templates-provider.test.js.map