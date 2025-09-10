## Usage Examples

### Example 1: Context-Aware Debugging

```typescript
// Example of context-aware debugging
class ContextAwareDebugger {
  private context: Context7Manager;
  
  constructor(initialContext?: Context7Manager) {
    this.context = initialContext || new Context7Manager();
  }
  
  logError(error: Error, source: string) {
    // Capture full context at the time of error
    const errorContext = {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        source
      },
      context: this.context.getFullContext()
    };
    
    // Log enhanced error
    console.error('Context-aware error:', JSON.stringify(errorContext, null, 2));
    
    // Optionally send to error tracking service
    // this.sendToErrorTrackingService(errorContext);
    
    return errorContext;
  }
  
  async diagnose(error: Error) {
    // Use context to enhance error diagnosis
    const userContext = this.context.getUserContext();
    const stateContext = this.context.getStateContext();
    const envContext = this.context.getEnvironmentalContext();
    
    console.log('Diagnostic information:');
    console.log('- User:', userContext.userId);
    console.log('- Auth status:', userContext.authStatus);
    console.log('- Application state:', Object.keys(stateContext.applicationState));
    console.log('- Environment:', envContext.operatingSystem);
    console.log('- Recent actions:', this.context.getTemporalContext().actionHistory.slice(-5));
    
    // Suggest potential fixes based on context
    return this.suggestFixes(error);
  }
  
  private suggestFixes(error: Error) {
    // Implementation to suggest fixes based on error and context
    // ...
    return [];
  }
}
```

### Example 2: Personalized User Experience

```typescript
// Example of context-aware UI personalization
class ContextAwareUI {
  private context: Context7Manager;
  
  constructor(initialContext?: Context7Manager) {
    this.context = initialContext || new Context7Manager();
  }
  
  renderDashboard() {
    const userContext = this.context.getUserContext();
    const taskContext = this.context.getTaskContext();
    const temporalContext = this.context.getTemporalContext();
    
    // Personalize dashboard based on context
    return {
      layout: userContext.preferences.dashboardLayout || 'default',
      theme: userContext.profile.theme,
      widgets: this.getPersonalizedWidgets(),
      recentItems: this.getRecentItems(temporalContext),
      suggestions: this.getSuggestions(userContext, taskContext),
      notifications: this.getRelevantNotifications()
    };
  }
  
  private getPersonalizedWidgets() {
    const userContext = this.context.getUserContext();
    
    // Base widgets everyone gets
    const widgets = ['messages', 'calendar'];
    
    // Add expertise-based widgets
    if (userContext.profile.expertise === 'advanced') {
      widgets.push('terminal', 'metrics', 'api-status');
    }
    
    // Add role-based widgets
    if (userContext.permissions.includes('admin')) {
      widgets.push('admin-panel', 'user-management');
    }
    
    // Add widgets based on usage patterns
    const actionFrequency = this.context.getTemporalContext().frequencyMap;
    if ((actionFrequency['view_documentation'] || 0) > 5) {
      widgets.push('documentation-shortcuts');
    }
    
    return widgets;
  }
  
  private getRecentItems(temporalContext: TemporalContext) {
    // Extract recently accessed items from action history
    // ...
    return [];
  }
  
  private getSuggestions(userContext: UserContext, taskContext: TaskContext) {
    // Generate contextually relevant suggestions
    // ...
    return [];
  }
  
  private getRelevantNotifications() {
    // Filter notifications based on context
    // ...
    return [];
  }
}
```

### Example 3: Multi-Session State Management

```typescript
// Example of context persistence across sessions
class PersistentContextManager {
  private context: Context7Manager;
  private storageKey: string;
  
  constructor(userId: string) {
    this.storageKey = `user-context-${userId}`;
    this.context = this.loadContext() || new Context7Manager();
    
    // Set up auto-save
    this.setupAutoSave();
  }
  
  private loadContext(): Context7Manager | null {
    try {
      // Try to load from localStorage
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(this.storageKey);
        if (saved) {
          return Context7Manager.deserialize(saved);
        }
      }
      
      // Try to load from server if localStorage failed
      // ...
      
      return null;
    } catch (error) {
      console.error('Failed to load context:', error);
      return null;
    }
  }
  
  private setupAutoSave() {
    // Save context every 30 seconds
    setInterval(() => {
      this.saveContext();
    }, 30000);
    
    // Save on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        this.saveContext();
      });
    }
  }
  
  saveContext() {
    try {
      // Update timestamp before saving
      this.context.updateTemporalContext({
        timestamp: Date.now()
      });
      
      // Save to localStorage
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.storageKey, this.context.serialize());
      }
      
      // Optionally save to server
      // this.saveToServer();
      
      return true;
    } catch (error) {
      console.error('Failed to save context:', error);
      return false;
    }
  }
  
  getContext() {
    return this.context;
  }
  
  clearContext() {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
    this.context = new Context7Manager();
    return true;
  }
}
```

### Example 4: Collaborative Environment

```typescript
// Example of shared context in a collaborative environment
class CollaborativeContext {
  private localContext: Context7Manager;
  private sharedContext: Context7Manager;
  private collaborationId: string;
  private socket: WebSocket;
  
  constructor(collaborationId: string, initialLocalContext?: Context7Manager) {
    this.collaborationId = collaborationId;
    this.localContext = initialLocalContext || new Context7Manager();
    this.sharedContext = new Context7Manager();
    
    // Connect to collaboration server
    this.connectToCollaborationServer();
  }
  
  private connectToCollaborationServer() {
    // Connect to WebSocket server for real-time context sharing
    this.socket = new WebSocket(`wss://collaboration.example.com/${this.collaborationId}`);
    
    this.socket.onopen = () => {
      // Request current shared context
      this.socket.send(JSON.stringify({
        type: 'get_shared_context'
      }));
    };
    
    this.socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'shared_context_update') {
        // Update our copy of the shared context
        this.sharedContext = Context7Manager.deserialize(message.context);
      }
    };
  }
  
  // Update the shared context
  updateSharedContext(update: Partial<Context7Manager>) {
    // Apply update to local copy of shared context
    // ... 
    
    // Send update to server
    this.socket.send(JSON.stringify({
      type: 'update_shared_context',
      update: JSON.stringify(update)
    }));
  }
  
  // Get combined context (local + shared)
  getCombinedContext() {
    // Merge local and shared context
    // Priority to local context for conflicts
    // ...
    
    return {
      local: this.localContext,
      shared: this.sharedContext,
      // combined: mergedContext
    };
  }
  
  // Share an action from local to shared context
  shareAction(action: string, metadata?: any) {
    const userId = this.localContext.getUserContext().userId;
    
    this.updateSharedContext({
      temporal: {
        actionHistory: [
          ...this.sharedContext.getTemporalContext().actionHistory,
          { 
            action,
            userId,
            timestamp: Date.now(),
            metadata
          }
        ]
      }
    });
  }
}
```

### Example 5: AI-Assisted Development

```typescript
// Example of AI-assisted development with context retention
class ContextAwareAIAssistant {
  private context: Context7Manager;
  private llmClient: any; // Simplified for example
  
  constructor(llmClient: any, initialContext?: Context7Manager) {
    this.context = initialContext || new Context7Manager();
    this.llmClient = llmClient;
  }
  
  async generateCodeSuggestion(codeContext: string) {
    // Get relevant context for the AI
    const userContext = this.context.getUserContext();
    const taskContext = this.context.getTaskContext();
    const semanticContext = this.context.getSemanticContext();
    
    // Compose prompt with rich context
    const prompt = `
      You are assisting a ${userContext.profile.expertise} level developer.
      
      Current task: ${taskContext.currentTask?.description}
      
      Recent actions: 
      ${this.context.getTemporalContext().actionHistory.slice(-5).map(a => 
        `- ${a.action} at ${new Date(a.timestamp).toISOString()}`
      ).join('\n')}
      
      Related entities:
      ${Array.from(semanticContext.entities.entries())
        .filter(([_, entity]) => entity.type === 'code')
        .slice(0, 3)
        .map(([key, entity]) => `- ${key}: ${JSON.stringify(entity.attributes)}`)
        .join('\n')
      }
      
      Code context:
      \`\`\`
      ${codeContext}
      \`\`\`
      
      Generate a code suggestion that would help complete the current task.
    `;
    
    // Call LLM with context-enhanced prompt
    const suggestion = await this.llmClient.complete(prompt);
    
    // Update context with this interaction
    this.context.recordUserAction('requested_code_suggestion');
    this.context.updateSemanticContext({
      entities: new Map([
        ...Array.from(semanticContext.entities.entries()),
        [`suggestion-${Date.now()}`, {
          type: 'suggestion',
          attributes: {
            prompt: prompt.substring(0, 100) + '...',
            response: suggestion.substring(0, 100) + '...',
            timestamp: Date.now()
          }
        }]
      ])
    });
    
    return suggestion;
  }
  
  async explainCode(code: string) {
    // Similar implementation with context-aware prompting
    // ...
    return "";
  }
  
  async suggestRefactoring(code: string) {
    // Similar implementation with context-aware prompting
    // ...
    return "";
  }
}
```

## Conclusion

The Context7 MCP component provides a comprehensive framework for managing context across seven dimensions, enabling richer, more intelligent software systems. By implementing Context7 in your applications, you can enhance user experiences, improve AI interactions, support collaborative environments, and build more adaptive systems.

Context7 works seamlessly with other MCP components like Sequential Thinking, Playwright, and Serena to provide a complete solution for complex software development challenges. The multi-dimensional approach ensures that no aspect of context is overlooked, leading to more robust and sophisticated applications.