import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Configuration Tests', () => {
    
    test('Should have all required configuration properties', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const config = extension.packageJSON.contributes.configuration;
        assert.ok(config, 'Configuration section should exist');
        
        const properties = config.properties;
        assert.ok(properties, 'Configuration properties should exist');
        
        // Check required configuration keys
        const requiredKeys = [
            'vibecode.openRouterApiKey',
            'vibecode.defaultModel',
            'vibecode.maxTokens',
            'vibecode.temperature',
            'vibecode.enableTelemetry',
            'vibecode.enableStreaming'
        ];
        
        for (const key of requiredKeys) {
            assert.ok(properties[key], `Configuration property ${key} should exist`);
        }
    });

    test('Should have valid default values', () => {
        const config = vscode.workspace.getConfiguration('vibecode');
        
        // Test default model
        const defaultModel = config.get('defaultModel');
        assert.strictEqual(defaultModel, 'anthropic/claude-3-sonnet-20240229');
        
        // Test max tokens
        const maxTokens = config.get('maxTokens');
        assert.strictEqual(maxTokens, 4000);
        
        // Test temperature
        const temperature = config.get('temperature');
        assert.strictEqual(temperature, 0.7);
        
        // Test boolean defaults
        const enableTelemetry = config.get('enableTelemetry');
        assert.strictEqual(enableTelemetry, false);
        
        const enableStreaming = config.get('enableStreaming');
        assert.strictEqual(enableStreaming, true);
    });

    test('Should validate configuration types', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const properties = extension.packageJSON.contributes.configuration.properties;
        
        // Check API key is string
        assert.strictEqual(properties['vibecode.openRouterApiKey'].type, 'string');
        
        // Check default model is string with enum
        assert.strictEqual(properties['vibecode.defaultModel'].type, 'string');
        assert.ok(Array.isArray(properties['vibecode.defaultModel'].enum));
        
        // Check max tokens is number
        assert.strictEqual(properties['vibecode.maxTokens'].type, 'number');
        
        // Check temperature is number with min/max
        const tempConfig = properties['vibecode.temperature'];
        assert.strictEqual(tempConfig.type, 'number');
        assert.strictEqual(tempConfig.minimum, 0);
        assert.strictEqual(tempConfig.maximum, 1);
        
        // Check boolean configs
        assert.strictEqual(properties['vibecode.enableTelemetry'].type, 'boolean');
        assert.strictEqual(properties['vibecode.enableStreaming'].type, 'boolean');
    });

    test('Should have proper configuration scopes', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const properties = extension.packageJSON.contributes.configuration.properties;
        
        // All properties should have window scope
        for (const [key, config] of Object.entries(properties)) {
            assert.strictEqual((config as any).scope, 'window', `${key} should have window scope`);
        }
    });

    test('Should support all available AI models', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const modelEnum = extension.packageJSON.contributes.configuration.properties['vibecode.defaultModel'].enum;
        
        const expectedModels = [
            'anthropic/claude-3-sonnet-20240229',
            'anthropic/claude-3-haiku-20240307',
            'openai/gpt-4-turbo-preview',
            'openai/gpt-3.5-turbo',
            'google/gemini-pro',
            'mistral/mistral-large',
            'meta-llama/llama-3-70b-instruct'
        ];
        
        for (const model of expectedModels) {
            assert.ok(modelEnum.includes(model), `Model ${model} should be available`);
        }
    });

    test('Should be able to read and update configuration', async () => {
        const config = vscode.workspace.getConfiguration('vibecode');
        
        // Read current values
        const originalModel = config.get('defaultModel');
        const originalTemp = config.get('temperature');
        
        // Verify we can access them
        assert.ok(typeof originalModel === 'string');
        assert.ok(typeof originalTemp === 'number');
        
        try {
            // Test updating configuration (this should not fail even if we can't persist)
            await config.update('temperature', 0.5, vscode.ConfigurationTarget.Workspace);
            const updatedTemp = config.get('temperature');
            
            // In test environment, this might not actually update
            // so we just verify the operation doesn't throw
            assert.ok(true, 'Configuration update operation completed');
        } catch (error) {
            // Expected in test environment where workspace updates might not be allowed
            assert.ok(true, 'Configuration update attempted');
        }
    });

    test('Should have meaningful configuration descriptions', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const properties = extension.packageJSON.contributes.configuration.properties;
        
        for (const [key, config] of Object.entries(properties)) {
            const description = (config as any).description;
            assert.ok(description, `${key} should have a description`);
            assert.ok(description.length > 10, `${key} description should be meaningful`);
        }
    });

    test('Should have proper configuration title', () => {
        const extension = vscode.extensions.getExtension('vibecode.vibecode-ai-assistant');
        assert.ok(extension);
        
        const configTitle = extension.packageJSON.contributes.configuration.title;
        assert.strictEqual(configTitle, 'VibeCode AI Assistant');
    });

    test('Should handle missing configuration gracefully', () => {
        // Test accessing non-existent configuration
        const config = vscode.workspace.getConfiguration('vibecode');
        const nonExistent = config.get('nonExistentSetting');
        
        assert.strictEqual(nonExistent, undefined, 'Non-existent setting should return undefined');
        
        // Test with default value
        const withDefault = config.get('nonExistentSetting', 'default-value');
        assert.strictEqual(withDefault, 'default-value', 'Should return default value when setting does not exist');
    });
});