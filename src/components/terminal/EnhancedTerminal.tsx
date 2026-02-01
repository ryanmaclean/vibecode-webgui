/**
 * Enhanced Terminal Component
 * Advanced terminal interface with AI integration and workspace features
 */

'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  PlayIcon,
  StopIcon,
  ArrowPathIcon,
  MagnifyingGlassIcon,
  CommandLineIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';

interface TerminalSession {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'error';
  command?: string;
  output: string[];
  exitCode?: number;
  startTime?: Date;
  endTime?: Date;
}

interface CommandSuggestion {
  command: string;
  description: string;
  category: 'navigation' | 'git' | 'npm' | 'system' | 'ai';
}

interface EnhancedTerminalProps {
  workspaceId?: string | number;
  projectId?: string;
  onCommandExecute?: (command: string, output: string) => void;
  onAISuggestion?: (suggestion: string) => void;
  className?: string;
  initialCommand?: string;
  theme?: 'dark' | 'light';
  enableAI?: boolean;
  enableWebGL?: boolean;
  onReady?: (terminal: unknown) => void;
}

export function EnhancedTerminal({
  workspaceId,
  projectId,
  onCommandExecute,
  onAISuggestion,
  className = '',
  initialCommand
}: EnhancedTerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const terminal = useRef<Terminal | null>(null);
  const fitAddon = useRef<FitAddon | null>(null);
  const [sessions, setSessions] = useState<TerminalSession[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAISuggestions, setShowAISuggestions] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<CommandSuggestion[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Initialize terminal
  useEffect(() => {
    if (terminalRef.current && !terminal.current) {
      initializeTerminal();
    }

    return () => {
      if (terminal.current) {
        terminal.current.dispose();
      }
    };
  }, []);

  // Handle initial command
  useEffect(() => {
    if (initialCommand && terminal.current) {
      executeCommand(initialCommand);
    }
  }, [initialCommand]);

  const initializeTerminal = () => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: '#1f2937',
        foreground: '#f9fafb',
        cursor: '#fbbf24',
        selectionBackground: '#374151',
        black: '#1f2937',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#8b5cf6',
        cyan: '#06b6d4',
        white: '#f9fafb',
        brightBlack: '#374151',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#a78bfa',
        brightCyan: '#22d3ee',
        brightWhite: '#f3f4f6'
      },
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Consolas, monospace',
      cursorBlink: true,
      allowTransparency: true,
      scrollback: 1000
    });

    const fit = new FitAddon();
    term.loadAddon(fit);

    term.open(terminalRef.current);
    fit.fit();

    // Handle terminal resize
    const resizeObserver = new ResizeObserver(() => {
      fit.fit();
    });
    resizeObserver.observe(terminalRef.current);

    // Handle input
    term.onData((data) => {
      handleTerminalInput(data);
    });

    // Handle cursor position
    term.onCursorMove(() => {
      // Update AI suggestions based on current command
      const currentLine = getCurrentLine();
      if (currentLine.trim()) {
        generateAISuggestions(currentLine);
      }
    });

    terminal.current = term;
    fitAddon.current = fit;

    // Create initial session
    const initialSession: TerminalSession = {
      id: 'session-1',
      name: 'Terminal Session',
      status: 'running',
      output: [],
      startTime: new Date()
    };

    setSessions([initialSession]);
    setActiveSession(initialSession.id);

    // Welcome message
    writeToTerminal('\x1b[32mWelcome to VibeCode Enhanced Terminal\x1b[0m\r\n');
    writeToTerminal('\x1b[36mType "help" for available commands or use AI suggestions.\x1b[0m\r\n');
    writeToTerminal('\x1b[90m─────────────────────────────────────────────────────────────────\x1b[0m\r\n');
    writeToTerminal('\r\n');
  };

  const handleTerminalInput = (data: string) => {
    if (!terminal.current) return;

    // Handle special keys
    if (data === '\r') { // Enter
      handleCommand(currentCommand);
      setCurrentCommand('');
      setHistoryIndex(-1);
      return;
    }

    if (data === '\x7f') { // Backspace
      if (currentCommand.length > 0) {
        setCurrentCommand(prev => prev.slice(0, -1));
        terminal.current.write('\b \b');
      }
      return;
    }

    if (data === '\x1b[A') { // Up arrow
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
        // Clear current line and write new command
        terminal.current.write('\x1b[2K\r');
        writeToTerminal(`\x1b[36m$\x1b[0m ${commandHistory[commandHistory.length - 1 - newIndex]}`);
      }
      return;
    }

    if (data === '\x1b[B') { // Down arrow
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[commandHistory.length - 1 - newIndex]);
        terminal.current.write('\x1b[2K\r');
        writeToTerminal(`\x1b[36m$\x1b[0m ${commandHistory[commandHistory.length - 1 - newIndex]}`);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCurrentCommand('');
        terminal.current.write('\x1b[2K\r');
        writeToTerminal('\x1b[36m$\x1b[0m ');
      }
      return;
    }

    if (data === '\x1b[C') { // Right arrow
      return; // Ignore for now
    }

    if (data === '\x1b[D') { // Left arrow
      return; // Ignore for now
    }

    // Handle tab completion
    if (data === '\t') {
      handleTabCompletion();
      return;
    }

    // Regular character input
    if (data >= ' ' && data <= '~') {
      setCurrentCommand(prev => prev + data);
      terminal.current.write(data);
    }
  };

  const handleCommand = async (command: string) => {
    if (!command.trim()) return;

    // Add to history
    setCommandHistory(prev => [...prev, command]);

    // Write command to terminal
    writeToTerminal(`\x1b[36m$\x1b[0m ${command}\r\n`);

    try {
      const output = await executeCommand(command);

      // Update session
      setSessions(prev => prev.map(session =>
        session.id === activeSession
          ? {
              ...session,
              command,
              output: [...session.output, ...output.split('\n')],
              status: 'running'
            }
          : session
      ));

      onCommandExecute?.(command, output);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Command failed';
      writeToTerminal(`\x1b[31mError: ${errorMessage}\x1b[0m\r\n`);

      // Update session with error
      setSessions(prev => prev.map(session =>
        session.id === activeSession
          ? {
              ...session,
              status: 'error',
              output: [...session.output, `Error: ${errorMessage}`],
              exitCode: 1
            }
          : session
      ));
    }

    writeToTerminal('\r\n');
  };

  const executeCommand = async (command: string): Promise<string> => {
    // This would integrate with your command execution service
    // For now, simulate command execution

    const [cmd, ...args] = command.trim().split(' ');

    switch (cmd) {
      case 'help':
        return [
          'Available commands:',
          '  help                    - Show this help message',
          '  clear                   - Clear terminal',
          '  ls [path]              - List directory contents',
          '  cd <path>              - Change directory',
          '  pwd                     - Print current directory',
          '  cat <file>             - Display file contents',
          '  echo <text>            - Display text',
          '  ai <query>             - Ask AI for help',
          '  git <command>          - Git operations',
          '  npm <command>          - NPM operations',
          '  history                 - Show command history',
          '',
          'Use Tab for auto-completion and ↑/↓ for command history.'
        ].join('\n');

      case 'clear':
        if (terminal.current) {
          terminal.current.clear();
        }
        return '';

      case 'echo':
        return args.join(' ');

      case 'pwd':
        return '/workspace';

      case 'ls':
        return [
          'src/',
          'public/',
          'package.json',
          'README.md',
          'tsconfig.json',
          '.gitignore'
        ].join('\n');

      case 'ai':
        const query = args.join(' ');
        return await handleAIQuery(query);

      case 'git':
        return handleGitCommand(args);

      case 'npm':
        return handleNpmCommand(args);

      default:
        return `Command not found: ${cmd}. Type 'help' for available commands.`;
    }
  };

  const handleAIQuery = async (query: string): Promise<string> => {
    // This would integrate with your AI services
    // For now, return mock response
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate AI processing

    if (query.toLowerCase().includes('error')) {
      return [
        'I see you\'re having an error. Let me help you debug this.',
        '',
        'Common solutions:',
        '1. Check your dependencies: npm ls',
        '2. Review error logs: npm run logs 2>&1 | tail -20',
        '3. Check TypeScript configuration',
        '4. Verify environment variables',
        '',
        'Would you like me to examine your specific error message?'
      ].join('\n');
    }

    return [
      'I can help you with that! Here are some suggestions:',
      '',
      '• For React components: Use functional components with hooks',
      '• For styling: Consider Tailwind CSS for rapid development',
      '• For state management: Redux Toolkit or Zustand',
      '• For API calls: React Query or SWR',
      '',
      'Try: npm create react-app my-app --template typescript'
    ].join('\n');
  };

  const handleGitCommand = (args: string[]): string => {
    if (args.length === 0) {
      return 'Git commands: status, add, commit, push, pull, log, branch';
    }

    const subcommand = args[0];
    switch (subcommand) {
      case 'status':
        return [
          'On branch main',
          'Your branch is up to date with \'origin/main\'.',
          '',
          'Changes not staged for commit:',
          '  modified:   src/components/Terminal.tsx',
          '',
          'Untracked files:',
          '  src/components/EnhancedTerminal.tsx',
          '',
          'no changes added to commit'
        ].join('\n');

      case 'add':
        return 'Added files to staging area';

      case 'commit':
        return '[main abc1234] Add enhanced terminal component';

      default:
        return `Git ${subcommand}: command not recognized`;
    }
  };

  const handleNpmCommand = (args: string[]): string => {
    if (args.length === 0) {
      return 'NPM commands: install, start, build, test, run <script>';
    }

    const subcommand = args[0];
    switch (subcommand) {
      case 'install':
        return [
          'Installing dependencies...',
          '+ react@18.2.0',
          '+ typescript@4.9.5',
          '+ @xterm/xterm@5.0.0',
          'Done!'
        ].join('\n');

      case 'start':
        return 'Starting development server...\nServer running at http://localhost:3000';

      case 'build':
        return [
          'Building project...',
          '✓ Compiled successfully',
          '✓ Type checking passed',
          '✓ Bundle size: 2.4 MB'
        ].join('\n');

      default:
        return `npm ${subcommand}: command not recognized`;
    }
  };

  const handleTabCompletion = () => {
    // Simple tab completion for common commands
    const commonCommands = ['help', 'clear', 'ls', 'cd', 'pwd', 'cat', 'echo', 'git', 'npm'];
    const currentCmd = currentCommand.toLowerCase();

    const matches = commonCommands.filter(cmd => cmd.startsWith(currentCmd));

    if (matches.length === 1) {
      const completion = matches[0].slice(currentCommand.length);
      setCurrentCommand(prev => prev + completion);
      if (terminal.current) {
        terminal.current.write(completion);
      }
    } else if (matches.length > 1) {
      writeToTerminal('\r\n');
      matches.forEach(match => {
        writeToTerminal(`${match}  `);
      });
      writeToTerminal('\r\n');
      writeToTerminal(`\x1b[36m$\x1b[0m ${currentCommand}`);
    }
  };

  const generateAISuggestions = async (partialCommand: string) => {
    // Generate AI-powered command suggestions
    const suggestions: CommandSuggestion[] = [];

    if (partialCommand.startsWith('git ')) {
      suggestions.push(
        { command: 'git status', description: 'Check repository status', category: 'git' },
        { command: 'git add .', description: 'Stage all changes', category: 'git' },
        { command: 'git commit -m "message"', description: 'Commit with message', category: 'git' }
      );
    } else if (partialCommand.startsWith('npm ')) {
      suggestions.push(
        { command: 'npm install', description: 'Install dependencies', category: 'npm' },
        { command: 'npm start', description: 'Start development server', category: 'npm' },
        { command: 'npm run build', description: 'Build for production', category: 'npm' }
      );
    } else if (partialCommand.includes('error') || partialCommand.includes('debug')) {
      suggestions.push(
        { command: 'npm run logs', description: 'Check application logs', category: 'system' },
        { command: 'npm run test', description: 'Run test suite', category: 'npm' }
      );
    } else {
      suggestions.push(
        { command: 'help', description: 'Show available commands', category: 'system' },
        { command: 'ls', description: 'List directory contents', category: 'navigation' },
        { command: 'pwd', description: 'Show current directory', category: 'navigation' }
      );
    }

    setAiSuggestions(suggestions);
    setShowAISuggestions(suggestions.length > 0);
  };

  const getCurrentLine = (): string => {
    // Get the current command line content
    return currentCommand;
  };

  const writeToTerminal = (text: string) => {
    if (terminal.current) {
      terminal.current.write(text);
    }
  };

  const handleAISuggestionSelect = (suggestion: CommandSuggestion) => {
    setCurrentCommand(suggestion.command);
    setShowAISuggestions(false);

    if (terminal.current) {
      // Clear current line and write suggestion
      terminal.current.write('\x1b[2K\r');
      writeToTerminal(`\x1b[36m$\x1b[0m ${suggestion.command}`);
    }

    onAISuggestion?.(suggestion.command);
  };

  const filteredSuggestions = aiSuggestions.filter(suggestion =>
    suggestion.command.toLowerCase().includes(searchQuery.toLowerCase()) ||
    suggestion.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`flex flex-col h-full bg-gray-900 ${className}`}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between p-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-3">
          <CommandLineIcon className="h-5 w-5 text-gray-400" />
          <span className="text-sm font-medium text-gray-300">Enhanced Terminal</span>
          {isConnected && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-400">Connected</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* AI Suggestions Toggle */}
          <button
            onClick={() => setShowAISuggestions(!showAISuggestions)}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              showAISuggestions
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            AI Suggestions
          </button>

          {/* Session Management */}
          <select
            value={activeSession || ''}
            onChange={(e) => setActiveSession(e.target.value)}
            className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded border-none focus:ring-1 focus:ring-blue-500"
          >
            {sessions.map(session => (
              <option key={session.id} value={session.id}>
                {session.name} ({session.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Terminal Container */}
      <div className="flex-1 relative">
        <div ref={terminalRef} className="h-full" />

        {/* AI Suggestions Panel */}
        {showAISuggestions && (
          <div className="absolute bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-3">
            <div className="flex items-center space-x-2 mb-3">
              <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search suggestions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 px-2 py-1 text-sm bg-gray-700 text-gray-300 rounded border-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-32 overflow-y-auto">
              {filteredSuggestions.map((suggestion, index) => (
                <button
                  key={index}
                  onClick={() => handleAISuggestionSelect(suggestion)}
                  className="p-2 text-left bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                >
                  <div className="font-mono text-blue-400">{suggestion.command}</div>
                  <div className="text-xs text-gray-400 mt-1">{suggestion.description}</div>
                  <div className="text-xs text-gray-500 mt-1 capitalize">{suggestion.category}</div>
                </button>
              ))}
            </div>

            {filteredSuggestions.length === 0 && (
              <div className="text-center py-4">
                <p className="text-sm text-gray-400">No suggestions found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="p-3 bg-gray-800 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center space-x-4">
            <span>Status: {isConnected ? 'Connected' : 'Disconnected'}</span>
            <span>History: {commandHistory.length} commands</span>
          </div>
          <div className="flex items-center space-x-2">
            <CpuChipIcon className="h-4 w-4" />
            <span>VibeCode Terminal v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedTerminal;
