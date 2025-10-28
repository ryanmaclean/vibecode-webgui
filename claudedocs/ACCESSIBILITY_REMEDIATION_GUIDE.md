# Accessibility Remediation Guide
## Implementation Instructions for WCAG 2.1 AA Compliance

**Target:** 100% WCAG 2.1 Level AA compliance
**Timeline:** 6 weeks (3 phases)
**Priority:** High

---

## Phase 1: Critical Issues (Weeks 1-2)

### 1.1 Add Semantic Landmarks

#### Root Layout (`src/app/layout.tsx`)

**Current:**
```typescript
<body className="antialiased">
  <Providers>{children}</Providers>
</body>
```

**Updated:**
```typescript
<body className="antialiased">
  {/* Skip Link - Always first focusable element */}
  <a
    href="#main-content"
    className="skip-link sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-white focus:text-black focus:px-4 focus:py-2 focus:rounded"
  >
    Skip to main content
  </a>
  <Providers>{children}</Providers>
</body>
```

**CSS for Skip Link (add to `globals.css`):**
```css
@layer utilities {
  /* Screen reader only utility */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  /* Show on focus */
  .focus\:not-sr-only:focus {
    position: static;
    width: auto;
    height: auto;
    padding: inherit;
    margin: inherit;
    overflow: visible;
    clip: auto;
    white-space: normal;
  }
}
```

#### Main Page (`src/app/page.tsx`)

**Current:**
```typescript
<div className="dark">
  <div className="min-h-screen bg-background">
    {/* Header */}
    <header className="border-b border-border bg-card">
      {/* ... */}
    </header>

    {/* Main Interface */}
    <div className="h-[calc(100vh-73px)]">
      <PromptInterface />
    </div>
  </div>
</div>
```

**Updated:**
```typescript
<div className="dark">
  <div className="min-h-screen bg-background">
    {/* Header with proper semantic role */}
    <header role="banner" className="border-b border-border bg-card">
      <nav role="navigation" aria-label="Main navigation">
        <div className="flex items-center justify-between px-6 py-3">
          {/* Logo and branding */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center" aria-hidden="true">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">VibeCode</h1>
              <p className="text-xs text-muted-foreground">AI Development Assistant</p>
            </div>
          </div>

          {/* Navigation links */}
          <div className="flex items-center gap-4" role="navigation" aria-label="Primary navigation">
            <Link href="/marketplace" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Template Marketplace
            </Link>
            <Link href="/tools/codeium" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Codeium Playground
            </Link>
            <Button variant="secondary" size="sm" onClick={() => setShowOnboarding(true)}>
              Welcome
            </Button>

            {/* User Menu */}
            <div
              className="relative"
              data-testid="user-menu"
              role="menu"
              aria-label="User account menu"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground" id="user-greeting">
                  Welcome, {user?.name || user?.email}
                </span>
                <button
                  onClick={logout}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="logout-button"
                  role="menuitem"
                  aria-label="Sign out of your account"
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </header>

    {/* Main Content Area */}
    <main id="main-content" role="main" className="h-[calc(100vh-73px)]">
      <h1 className="sr-only">AI Development Interface</h1>
      <PromptInterface />
    </main>
  </div>
  <OnboardingDrawer open={showOnboarding} onClose={() => setShowOnboarding(false)} />
</div>
```

---

### 1.2 Implement ARIA Live Regions

#### Create Announcer Component

**File:** `src/components/accessibility/Announcer.tsx`

```typescript
'use client'

import React, { useEffect, useState, createContext, useContext } from 'react'

type AnnouncementPriority = 'polite' | 'assertive'

interface AnnouncementContextType {
  announce: (message: string, priority?: AnnouncementPriority) => void
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined)

export function useAnnouncer() {
  const context = useContext(AnnouncementContext)
  if (!context) {
    throw new Error('useAnnouncer must be used within AnnouncerProvider')
  }
  return context
}

export function AnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState('')
  const [assertiveMessage, setAssertiveMessage] = useState('')

  const announce = (message: string, priority: AnnouncementPriority = 'polite') => {
    if (priority === 'assertive') {
      setAssertiveMessage(message)
      // Clear after announcement
      setTimeout(() => setAssertiveMessage(''), 1000)
    } else {
      setPoliteMessage(message)
      // Clear after announcement
      setTimeout(() => setPoliteMessage(''), 1000)
    }
  }

  return (
    <AnnouncementContext.Provider value={{ announce }}>
      {children}

      {/* Screen reader announcements - visually hidden */}
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {politeMessage}
      </div>
      <div className="sr-only" role="alert" aria-live="assertive" aria-atomic="true">
        {assertiveMessage}
      </div>
    </AnnouncementContext.Provider>
  )
}
```

#### Update MessageList with ARIA Live Region

**File:** `src/components/MessageList.tsx`

```typescript
import React, { useMemo } from 'react';
import { useAnnouncer } from './accessibility/Announcer';
// ... other imports

const MessageList = React.memo(({ messages, isTyping }: MessageListProps) => {
  const { announce } = useAnnouncer();

  // Announce new assistant messages
  React.useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.type === 'assistant' && lastMessage.content) {
      announce(`AI responded: ${lastMessage.content.substring(0, 100)}...`, 'polite');
    }
  }, [messages, announce]);

  const processedMessages = useMemo(() => {
    return messages.map(message => ({
      ...message,
    }));
  }, [messages]);

  return (
    <div
      role="log"
      aria-label="Chat conversation"
      aria-live="polite"
      aria-atomic="false"
      aria-relevant="additions"
    >
      {processedMessages.map((message) => (
        <article
          key={message.id}
          className={cn(
            "flex w-full",
            message.type === "user" ? "justify-end" : "justify-start"
          )}
          aria-labelledby={`message-${message.id}-author`}
        >
          <div className={cn(
            "max-w-[80%] rounded-lg p-4",
            message.type === "user"
              ? "bg-gradient-to-r from-purple-500 to-blue-600 text-white ml-12"
              : "bg-card border mr-12"
          )}>
            <div className="flex items-start gap-3">
              {message.type === "assistant" && (
                <div
                  className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <Sparkles className="w-3 h-3 text-white" />
                </div>
              )}
              <div className="flex-1">
                <h3 id={`message-${message.id}-author`} className="sr-only">
                  {message.type === 'user' ? 'You' : 'AI Assistant'}
                </h3>
                <p className="text-sm leading-relaxed">{message.content}</p>

                {/* Audio Message */}
                {message.audioUrl && (
                  <div className="mt-3">
                    <audio
                      controls
                      className="w-full max-w-sm"
                      aria-label={`Audio message from ${message.type === 'user' ? 'you' : 'AI assistant'}`}
                    >
                      <source src={message.audioUrl} type="audio/wav" />
                      Your browser does not support audio playback.
                    </audio>
                    {message.transcription && (
                      <p className="text-xs text-muted-foreground mt-1 italic" aria-label="Transcription">
                        &quot;{message.transcription}&quot;
                      </p>
                    )}
                  </div>
                )}

                {/* File Attachments */}
                {message.attachments && message.attachments.length > 0 && (
                  <div className="mt-3 space-y-2" role="list" aria-label="Message attachments">
                    {message.attachments.map((attachment) => (
                      <div
                        key={attachment.id}
                        className="flex items-center gap-2 p-2 bg-muted/50 rounded"
                        role="listitem"
                      >
                        {attachment.type === 'image' && <Image className="w-4 h-4" aria-hidden="true" />}
                        {attachment.type === 'code' && <FileCode className="w-4 h-4" aria-hidden="true" />}
                        {attachment.type === 'document' && <FileText className="w-4 h-4" aria-hidden="true" />}
                        {attachment.type === 'audio' && <Headphones className="w-4 h-4" aria-hidden="true" />}
                        <span className="text-xs">{attachment.name}</span>
                        <span className="text-xs text-muted-foreground">
                          ({(attachment.size / 1024).toFixed(1)}KB)
                        </span>
                        {attachment.type === 'audio' && attachment.url && (
                          <audio
                            controls
                            className="ml-2"
                            style={{ height: '24px', fontSize: '12px' }}
                            aria-label={`Audio attachment: ${attachment.name}`}
                          >
                            <source src={attachment.url} type={attachment.mimeType || 'audio/wav'} />
                          </audio>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Metadata */}
                {message.metadata && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-1" role="list" aria-label="Message metadata">
                      {message.metadata.codeGenerated && (
                        <Badge variant="secondary" className="text-xs" role="listitem">
                          <Code className="w-3 h-3 mr-1" aria-hidden="true" />
                          <span>Code Generated</span>
                        </Badge>
                      )}
                      {message.metadata.deploymentUrl && (
                        <Badge variant="secondary" className="text-xs" role="listitem">
                          <Globe className="w-3 h-3 mr-1" aria-hidden="true" />
                          <span>Deployed</span>
                        </Badge>
                      )}
                      {message.metadata.audioInputMethod && (
                        <Badge variant="secondary" className="text-xs" role="listitem">
                          <Mic className="w-3 h-3 mr-1" aria-hidden="true" />
                          <span>Voice Input</span>
                        </Badge>
                      )}
                      {message.metadata.framework && (
                        <Badge variant="outline" className="text-xs" role="listitem">
                          {message.metadata.framework}
                        </Badge>
                      )}
                    </div>

                    {/* Token and Cost Info */}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-label="Usage statistics">
                      {message.metadata.tokens && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          <span aria-label={`${message.metadata.tokens} tokens used`}>
                            {message.metadata.tokens} tokens
                          </span>
                        </span>
                      )}
                      {message.metadata.cost !== undefined && (
                        <span className="flex items-center gap-1">
                          <DollarSign className="w-3 h-3" aria-hidden="true" />
                          <span aria-label={`Cost: ${message.metadata.cost.toFixed(4)} dollars`}>
                            ${message.metadata.cost.toFixed(4)}
                          </span>
                        </span>
                      )}
                      {message.metadata.duration && (
                        <span aria-label={`Duration: ${(message.metadata.duration / 1000).toFixed(1)} seconds`}>
                          {(message.metadata.duration / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>

                    {/* Components */}
                    {message.metadata.components && (
                      <div className="flex flex-wrap gap-1 mt-2" role="list" aria-label="Generated components">
                        {message.metadata.components.map((comp, index) => (
                          <Badge key={index} variant="outline" className="text-xs" role="listitem">
                            {comp}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </article>
      ))}

      {isTyping && (
        <div
          className="flex justify-start"
          role="status"
          aria-label="AI assistant is typing"
          aria-live="polite"
        >
          <div className="bg-card border rounded-lg p-4 mr-12">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 bg-gradient-to-r from-purple-500 to-blue-600 rounded-full flex items-center justify-center" aria-hidden="true">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <div className="flex gap-1" aria-hidden="true">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-75"></div>
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse delay-150"></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MessageList.displayName = 'MessageList';

export default MessageList;
```

---

### 1.3 Fix Keyboard Navigation for File Uploads

#### Update InputArea Component

**File:** `src/components/InputArea.tsx`

```typescript
// Add keyboard handler for file upload
const handleFileButtonKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    fileInputRef.current?.click();
  }
};

return (
  <div className="p-4 border-t border-border/50">
    {/* ... existing code ... */}

    <div className="flex gap-2">
      <div className="flex-1 relative">
        <Textarea
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type, upload files, or speak to me..."
          className="min-h-12 max-h-32 resize-none pr-32"
          disabled={isTyping}
          aria-label="Message input"
          aria-describedby="input-help"
        />
        <div className="absolute bottom-2 right-2 flex gap-1">
          {/* Voice Recognition Button */}
          {voiceSupported && (
            <Button
              variant="ghost"
              size="sm"
              onClick={isListening ? onStopVoiceRecognition : onStartVoiceRecognition}
              className={cn(
                "p-1 h-8 w-8",
                isListening && "bg-green-100 text-green-600"
              )}
              disabled={isRecording}
              aria-label={isListening ? "Stop voice recognition" : "Start voice recognition"}
              aria-pressed={isListening}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Mic className="w-4 h-4" aria-hidden="true" />
              )}
            </Button>
          )}

          {/* Audio Recording Button */}
          {currentModel?.supportsAudio && (
            <Button
              variant="ghost"
              size="sm"
              onClick={isRecording ? onStopAudioRecording : onStartAudioRecording}
              className={cn(
                "p-1 h-8 w-8",
                isRecording && "bg-red-100 text-red-600"
              )}
              disabled={isListening}
              aria-label={isRecording ? "Stop audio recording" : "Start audio recording"}
              aria-pressed={isRecording}
            >
              <Radio className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}

          {/* File Upload - Keyboard Accessible */}
          {currentModel?.supportsFiles && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={onFileUpload}
                className="sr-only"
                id="file-upload-input"
                aria-label="Upload files"
                accept=".jpg,.jpeg,.png,.gif,.pdf,.txt,.md,.js,.ts,.tsx,.jsx,.py"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={handleFileButtonKeyDown}
                className="p-1 h-8 w-8"
                aria-label="Attach files"
                aria-describedby="file-upload-help"
              >
                <Paperclip className="w-4 h-4" aria-hidden="true" />
              </Button>
            </>
          )}

          {/* Prompt Enhancement */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onEnhancePrompt}
            disabled={!input.trim() || isTyping}
            className="p-1 h-8 w-8"
            aria-label="Enhance prompt with AI suggestions"
            aria-describedby="enhance-help"
          >
            <Zap className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Button
        onClick={onSend}
        disabled={(!input.trim() && attachments.length === 0) || isTyping}
        className="bg-gradient-to-r from-purple-500 to-blue-600 hover:opacity-90"
        aria-label="Send message"
      >
        <Send className="w-4 h-4" aria-hidden="true" />
        <span className="sr-only">Send</span>
      </Button>
    </div>

    {/* Input Info */}
    <div
      className="flex items-center justify-between mt-2 text-xs text-muted-foreground"
      id="input-help"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-3">
        <span id="keyboard-help">Press Enter to send, Shift+Enter for new line</span>
        {input && (
          <span className="flex items-center gap-1" aria-label={`Approximately ${estimateTokens(input)} tokens`}>
            <Clock className="w-3 h-3" aria-hidden="true" />
            ~{estimateTokens(input)} tokens
          </span>
        )}
        {voiceSupported && (
          <span className="flex items-center gap-1" aria-label="Voice input is ready">
            <Mic className="w-3 h-3" aria-hidden="true" />
            Voice ready
          </span>
        )}
      </div>
      {currentModel && input && (
        <span
          className="flex items-center gap-1"
          aria-label={`Estimated cost: ${estimateCost(estimateTokens(input), currentModel).toFixed(4)} dollars`}
        >
          <DollarSign className="w-3 h-3" aria-hidden="true" />
          ~${estimateCost(estimateTokens(input), currentModel).toFixed(4)}
        </span>
      )}
    </div>

    {/* Hidden descriptions for screen readers */}
    <div className="sr-only">
      <p id="file-upload-help">
        Upload images, code files, or documents to share with the AI assistant.
        Supported formats: JPG, PNG, PDF, TXT, Markdown, JavaScript, TypeScript, Python.
      </p>
      <p id="enhance-help">
        Enhance your prompt with AI-generated suggestions to improve clarity and detail.
      </p>
    </div>
  </div>
);
```

---

## Phase 2: Important Improvements (Weeks 3-4)

### 2.1 Establish Proper Heading Hierarchy

#### Update EnhancedAIChatInterface

**File:** `src/components/EnhancedAIChatInterface.tsx`

```typescript
return (
  <div className={cn("flex flex-col h-full max-w-4xl mx-auto", className)} role="region" aria-label="AI Chat Interface">
    {/* Header with Model Selection */}
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Enhanced AI Assistant</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowSettings(!showSettings)}
            aria-label={showSettings ? "Hide settings" : "Show settings"}
            aria-expanded={showSettings}
            aria-controls="chat-settings"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Model Selection */}
        <div className="flex items-center gap-4 flex-wrap">
          <fieldset className="flex items-center gap-2">
            <legend className="text-sm font-medium">Model:</legend>
            <Select value={selectedModel} onValueChange={handleModelChange}>
              <SelectTrigger className="w-48" aria-label="Select AI model">
                <SelectValue />
              </SelectTrigger>
              <SelectContent role="listbox">
                {Object.values(AI_PROVIDERS).map(provider => (
                  <div key={provider.id} role="group" aria-labelledby={`provider-${provider.id}`}>
                    <div
                      id={`provider-${provider.id}`}
                      className="px-2 py-1 text-xs font-semibold text-gray-500"
                      role="presentation"
                    >
                      {provider.name}
                    </div>
                    {provider.models.map(model => (
                      <SelectItem
                        key={model.id}
                        value={model.id}
                        role="option"
                      >
                        <div className="flex items-center gap-2">
                          <span>{model.name}</span>
                          <Badge variant="secondary" className="text-xs">
                            ${model.costPer1kTokens.input}k
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </fieldset>

          {/* Quick Selection */}
          <fieldset>
            <legend className="sr-only">Quick model selection by use case</legend>
            <div className="flex gap-1" role="group" aria-label="Quick model selection">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('coding')}
                className="text-xs"
                aria-label="Select best model for coding tasks"
              >
                <Zap className="h-3 w-3 mr-1" aria-hidden="true" />
                Coding
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('reasoning')}
                className="text-xs"
                aria-label="Select best model for reasoning tasks"
              >
                <Brain className="h-3 w-3 mr-1" aria-hidden="true" />
                Reasoning
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('speed')}
                className="text-xs"
                aria-label="Select fastest model"
              >
                <Clock className="h-3 w-3 mr-1" aria-hidden="true" />
                Speed
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleQuickSelect('cost')}
                className="text-xs"
                aria-label="Select most cost-effective model"
              >
                <DollarSign className="h-3 w-3 mr-1" aria-hidden="true" />
                Cost
              </Button>
            </div>
          </fieldset>
        </div>

        {/* Model Info */}
        {currentModel && currentProvider && (
          <div className="flex items-center gap-4 text-sm text-gray-600" role="status" aria-live="polite">
            <span>
              <strong>{currentProvider.name}</strong> - {currentModel.description}
            </span>
            <Badge variant="outline" aria-label={`Context window: ${currentModel.contextWindow.toLocaleString()} tokens`}>
              {currentModel.contextWindow.toLocaleString()} tokens
            </Badge>
            {totalCost > 0 && (
              <Badge variant="secondary" aria-label={`Session cost: ${totalCost.toFixed(4)} dollars`}>
                Session cost: ${totalCost.toFixed(4)}
              </Badge>
            )}
          </div>
        )}
      </CardHeader>

      {/* Settings Panel */}
      {showSettings && (
        <CardContent className="pt-0 border-t" id="chat-settings" role="region" aria-label="Chat settings">
          <h3 className="sr-only">Chat Configuration</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4" aria-hidden="true" />
              <label htmlFor="enable-tools-switch" className="text-sm font-medium">
                Enable AI Tools
              </label>
            </div>
            <Switch
              id="enable-tools-switch"
              checked={enableTools}
              onCheckedChange={setEnableTools}
              aria-describedby="tools-description"
            />
          </div>
          <p id="tools-description" className="text-xs text-gray-500 mt-1">
            Tools allow the AI to search code, analyze projects, and generate specific code snippets.
          </p>
        </CardContent>
      )}
    </Card>

    {/* Messages */}
    <section
      className="flex-1 overflow-y-auto space-y-4 p-4 bg-gray-50 rounded-lg"
      aria-label="Chat messages"
    >
      <h2 className="sr-only">Conversation History</h2>
      {messages.length === 0 && (
        <div className="text-center text-gray-500 py-8" role="status">
          <Bot className="h-12 w-12 mx-auto mb-4 text-gray-300" aria-hidden="true" />
          <h3 className="text-lg font-medium mb-2">AI Assistant Ready</h3>
          <p className="text-sm">
            Ask me about your code, request new features, or get help with debugging.
            I have access to your workspace context and can use tools to help you.
          </p>
        </div>
      )}

      {/* Messages rendered here */}
      {/* ... */}
    </section>

    {/* Input */}
    <div className="mt-4 flex gap-2">
      {/* ... */}
    </div>
  </div>
)
```

---

### 2.2 Implement Focus Management

#### Create Focus Trap Hook

**File:** `src/hooks/useFocusTrap.ts`

```typescript
import { useEffect, useRef } from 'react'

export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    // Store current focus
    previousFocusRef.current = document.activeElement as HTMLElement

    // Get all focusable elements
    const getFocusableElements = () => {
      if (!containerRef.current) return []

      return Array.from(
        containerRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(el => {
        // Filter out hidden elements
        return el.offsetParent !== null
      })
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = getFocusableElements()
      if (focusableElements.length === 0) return

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      // Shift + Tab (backwards)
      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement.focus()
        }
      }
      // Tab (forwards)
      else {
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement.focus()
        }
      }
    }

    // Focus first element
    const focusableElements = getFocusableElements()
    if (focusableElements.length > 0) {
      focusableElements[0].focus()
    }

    // Add event listener
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)

      // Restore previous focus
      if (previousFocusRef.current && !isActive) {
        previousFocusRef.current.focus()
      }
    }
  }, [isActive])

  return containerRef
}
```

#### Update Onboarding Drawer

**File:** `src/components/onboarding/OnboardingDrawer.tsx`

```typescript
import { useFocusTrap } from '@/hooks/useFocusTrap'

export function OnboardingDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const drawerRef = useFocusTrap(open)

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="drawer-title"
      aria-describedby="drawer-description"
    >
      <div
        ref={drawerRef as React.RefObject<HTMLDivElement>}
        className="fixed right-0 top-0 h-full w-96 bg-white shadow-xl"
        role="document"
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 id="drawer-title" className="text-xl font-bold">
            Welcome to VibeCode
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded"
            aria-label="Close welcome drawer"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div id="drawer-description" className="p-6">
          {/* Drawer content */}
        </div>
      </div>
    </div>
  )
}
```

---

## Phase 3: Polish & Documentation (Weeks 5-6)

### 3.1 Keyboard Shortcut System

#### Create Keyboard Shortcut Hook

**File:** `src/hooks/useKeyboardShortcuts.ts`

```typescript
import { useEffect } from 'react'

export interface Shortcut {
  key: string
  ctrlKey?: boolean
  altKey?: boolean
  shiftKey?: boolean
  metaKey?: boolean
  action: () => void
  description: string
  preventDefault?: boolean
}

export function useKeyboardShortcuts(shortcuts: Shortcut[], enabled = true) {
  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (e: KeyboardEvent) => {
      shortcuts.forEach(shortcut => {
        const keyMatches = e.key.toLowerCase() === shortcut.key.toLowerCase()
        const ctrlMatches = shortcut.ctrlKey ? e.ctrlKey : !e.ctrlKey
        const altMatches = shortcut.altKey ? e.altKey : !e.altKey
        const shiftMatches = shortcut.shiftKey ? e.shiftKey : !e.shiftKey
        const metaMatches = shortcut.metaKey ? e.metaKey : !e.metaKey

        if (keyMatches && ctrlMatches && altMatches && shiftMatches && metaMatches) {
          if (shortcut.preventDefault) {
            e.preventDefault()
          }
          shortcut.action()
        }
      })
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts, enabled])
}

// Shortcut help component
export function ShortcutHelp({ shortcuts }: { shortcuts: Shortcut[] }) {
  return (
    <div role="dialog" aria-labelledby="shortcuts-title" className="p-6">
      <h2 id="shortcuts-title" className="text-xl font-bold mb-4">
        Keyboard Shortcuts
      </h2>
      <table className="w-full">
        <caption className="sr-only">Available keyboard shortcuts</caption>
        <thead>
          <tr>
            <th scope="col" className="text-left pb-2">Shortcut</th>
            <th scope="col" className="text-left pb-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {shortcuts.map((shortcut, index) => (
            <tr key={index} className="border-t">
              <td className="py-2 font-mono text-sm">
                {formatShortcut(shortcut)}
              </td>
              <td className="py-2 text-sm">{shortcut.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = []
  if (shortcut.ctrlKey) parts.push('Ctrl')
  if (shortcut.altKey) parts.push('Alt')
  if (shortcut.shiftKey) parts.push('Shift')
  if (shortcut.metaKey) parts.push('Cmd')
  parts.push(shortcut.key.toUpperCase())
  return parts.join(' + ')
}
```

---

## Testing & Validation

### Automated Testing Script

**File:** `scripts/test-accessibility.sh`

```bash
#!/bin/bash
# Accessibility Testing Script

echo "Running accessibility tests..."

# 1. Automated axe-core tests
echo "\n1. Running automated accessibility tests..."
npm run test -- tests/accessibility/automated-a11y.test.ts

# 2. E2E accessibility tests
echo "\n2. Running E2E accessibility tests..."
npm run test:e2e -- tests/e2e/accessibility.test.ts

# 3. Color contrast tests
echo "\n3. Running color contrast tests..."
npm run test -- tests/accessibility/contrast.test.ts

# 4. Generate accessibility report
echo "\n4. Generating accessibility report..."
npm run test:e2e -- --reporter=html

echo "\n✅ Accessibility tests complete!"
echo "View detailed report at: playwright-report/index.html"
```

### CI/CD Integration

**File:** `.github/workflows/accessibility.yml`

```yaml
name: Accessibility Testing

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  a11y-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run accessibility tests
        run: |
          npm run test -- tests/accessibility/
          npm run test:e2e -- tests/e2e/accessibility.test.ts

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: accessibility-report
          path: playwright-report/

      - name: Comment PR with results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            // Add logic to parse results and comment on PR
```

---

## Documentation

### Accessibility Guidelines for Developers

**File:** `docs/ACCESSIBILITY_GUIDELINES.md`

```markdown
# Accessibility Guidelines

## Quick Checklist

Before submitting a PR, ensure:

- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1 for text)
- [ ] Images have appropriate alt text
- [ ] Forms have proper labels
- [ ] Dynamic content has ARIA live regions
- [ ] Semantic HTML is used (header, main, nav, etc.)
- [ ] Headings follow logical hierarchy (h1 → h2 → h3)

## Component Requirements

### Buttons
- Use `<button>` element (not `<div>` with onClick)
- Include `aria-label` for icon-only buttons
- Ensure keyboard activation (Enter/Space)

### Forms
- All inputs must have associated `<label>` elements
- Use `aria-describedby` for helper text
- Mark required fields with `aria-required="true"`
- Associate error messages with `aria-describedby`

### Modals/Dialogs
- Use `role="dialog"` and `aria-modal="true"`
- Implement focus trap
- Close on Escape key
- Return focus to trigger element

### Dynamic Content
- Use `aria-live` regions for status updates
- Use `role="status"` for non-critical updates
- Use `role="alert"` for critical messages

## Testing

### Manual Testing
1. Navigate entire UI with keyboard only
2. Test with screen reader (NVDA/VoiceOver)
3. Zoom to 200% and verify usability
4. Test in high contrast mode

### Automated Testing
```bash
npm run test -- tests/accessibility/
```

## Resources
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Accessibility Checker](https://wave.webaim.org/)
```

---

## Summary

This remediation guide provides:

1. **Phase 1** (Weeks 1-2): Critical semantic HTML, ARIA live regions, keyboard navigation
2. **Phase 2** (Weeks 3-4): Heading hierarchy, focus management, form improvements
3. **Phase 3** (Weeks 5-6): Keyboard shortcuts, documentation, automated testing

**Expected Outcome:** 100% WCAG 2.1 AA compliance with comprehensive test coverage and documentation.

**Next Steps:**
1. Review and approve implementation plan
2. Assign tasks to development team
3. Begin Phase 1 implementation
4. Schedule weekly accessibility reviews
