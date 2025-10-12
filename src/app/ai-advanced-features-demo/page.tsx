'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Loader2,
  Code,
  TestTube,
  Lightbulb,
  FileText,
  Zap,
  Shield,
  Gauge,
  Database,
  CheckCircle,
  AlertTriangle,
  XCircle
} from 'lucide-react';

export default function AIAdvancedFeaturesDemo() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>({});

  // Test Generation State
  const [testCode, setTestCode] = useState(`function calculateSum(a: number, b: number): number {
  return a + b;
}

function findMax(arr: number[]): number {
  let max = arr[0];
  for (let i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      max = arr[i];
    }
  }
  return max;
}`);

  // Code Completion State
  const [completionPrompt, setCompletionPrompt] = useState('Create a React component for a user profile');
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');

  // Natural Language to Code State
  const [nlPrompt, setNlPrompt] = useState('Create a function that validates email addresses');

  // Code Review State
  const [reviewCode, setReviewCode] = useState(`function getUserData(userId: string) {
  const query = "SELECT * FROM users WHERE id = " + userId;
  const result = executeQuery(query);
  return result;
}

function processUserInput(input: string) {
  // Security fix: use textContent instead of innerHTML
  const outputElement = document.getElementById('output');
  if (outputElement) outputElement.textContent = input;
  return input;
}`);

  // Performance Analysis State
  const [performanceCode, setPerformanceCode] = useState(`function inefficientSearch(arr: number[], target: number): number {
  for (let i = 0; i < arr.length; i++) {
    for (let j = 0; j < arr.length; j++) {
      if (arr[i] + arr[j] === target) {
        return i;
      }
    }
  }
  return -1;
}

function addEventListener() {
  document.addEventListener('click', function() {
    console.log('clicked');
  });
}`);

  // Integration Testing State
  const [systemDescription, setSystemDescription] = useState('E-commerce platform with user management, product catalog, and payment processing');
  const [components, setComponents] = useState('User API, Product API, Payment API, Database, Authentication Service');

  const handleTestGeneration = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setResults(prev => ({
      ...prev,
      testGeneration: {
        tests: [
          {
            name: 'calculateSum should return correct sum',
            code: `test('calculateSum should return correct sum', () => {
  expect(calculateSum(2, 3)).toBe(5);
  expect(calculateSum(-1, 1)).toBe(0);
  expect(calculateSum(0, 0)).toBe(0);
});`
          },
          {
            name: 'findMax should return maximum value',
            code: `test('findMax should return maximum value', () => {
  expect(findMax([1, 2, 3, 4, 5])).toBe(5);
  expect(findMax([5, 4, 3, 2, 1])).toBe(5);
  expect(findMax([1])).toBe(1);
});`
          }
        ],
        coverage: '100%',
        recommendations: [
          'Add edge case tests for empty arrays',
          'Consider testing with negative numbers',
          'Add type checking tests'
        ]
      }
    }));
    setIsLoading(false);
  };

  const handleCodeCompletion = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    setResults(prev => ({
      ...prev,
      codeCompletion: {
        suggestions: [
          {
            type: 'component',
            code: `interface UserProfileProps {
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  onEdit?: () => void;
}

export function UserProfile({ user, onEdit }: UserProfileProps) {
  return (
    <div className="user-profile">
      <div className="avatar">
        {user.avatar ? (
          <img src={user.avatar} alt={user.name} />
        ) : (
          <div className="default-avatar">{user.name[0]}</div>
        )}
      </div>
      <div className="user-info">
        <h2>{user.name}</h2>
        <p>{user.email}</p>
        {onEdit && (
          <button onClick={onEdit}>Edit Profile</button>
        )}
      </div>
    </div>
  );
}`
          },
          {
            type: 'hook',
            code: `export function useUserProfile(userId: string) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchUser(userId)
      .then(setUser)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [userId]);

  return { user, loading, error };
}`
          }
        ]
      }
    }));
    setIsLoading(false);
  };

  const handleNaturalLanguageToCode = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 1800));
    
    setResults(prev => ({
      ...prev,
      naturalLanguageToCode: {
        code: `function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Usage examples
console.log(validateEmail('user@example.com')); // true
console.log(validateEmail('invalid-email')); // false
console.log(validateEmail('user@domain')); // false`,
        tests: `test('validateEmail should validate correct emails', () => {
  expect(validateEmail('user@example.com')).toBe(true);
  expect(validateEmail('test.user@domain.co.uk')).toBe(true);
});

test('validateEmail should reject invalid emails', () => {
  expect(validateEmail('invalid-email')).toBe(false);
  expect(validateEmail('user@')).toBe(false);
  expect(validateEmail('@domain.com')).toBe(false);
});`,
        documentation: `/**
 * Validates an email address using regex pattern matching
 * @param email - The email address to validate
 * @returns true if the email is valid, false otherwise
 * 
 * @example
 * validateEmail('user@example.com') // returns true
 * validateEmail('invalid-email') // returns false
 */`
      }
    }));
    setIsLoading(false);
  };

  const handleCodeReview = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    setResults(prev => ({
      ...prev,
      codeReview: {
        issues: [
          {
            severity: 'critical',
            category: 'security',
            message: 'SQL Injection vulnerability detected',
            lineNumber: 2,
            suggestion: 'Use parameterized queries or prepared statements',
            impact: 'Critical security risk - immediate attention required'
          },
          {
            severity: 'high',
            category: 'security',
            message: 'XSS vulnerability with innerHTML',
            lineNumber: 7,
            suggestion: 'Use textContent or proper sanitization',
            impact: 'High security risk - user input can execute malicious code'
          }
        ],
        summary: 'Found 2 critical security issues that need immediate attention',
        recommendations: [
          '🔒 Prioritize security fixes - implement proper input validation',
          '🛡️ Use parameterized queries for database operations',
          '🧹 Sanitize user input before rendering to DOM'
        ]
      }
    }));
    setIsLoading(false);
  };

  const handlePerformanceAnalysis = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setResults(prev => ({
      ...prev,
      performanceAnalysis: {
        issues: [
          {
            type: 'algorithm',
            severity: 'high',
            title: 'O(n²) Complexity Algorithm',
            description: 'Nested loops create quadratic time complexity',
            suggestion: 'Use hash map for O(n) lookup',
            estimatedImprovement: '90% improvement for large datasets'
          },
          {
            type: 'memory',
            severity: 'medium',
            title: 'Potential Memory Leak',
            description: 'Event listener added without cleanup',
            suggestion: 'Store reference and remove on cleanup',
            estimatedImprovement: 'Prevents memory leaks'
          }
        ],
        optimizationScore: 65,
        summary: 'Found 2 performance issues: 1 high priority, 1 medium priority',
        recommendations: [
          '⚡ Optimize algorithms - use hash maps for O(1) lookup',
          '🧠 Address memory leaks - implement proper cleanup',
          '📊 Profile memory usage in production'
        ]
      }
    }));
    setIsLoading(false);
  };

  const handleIntegrationTesting = async () => {
    setIsLoading(true);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    setResults(prev => ({
      ...prev,
      integrationTesting: {
        testSuite: {
          name: 'E-commerce Platform Integration Tests',
          scenarios: [
            {
              name: 'User Authentication Flow',
              category: 'authentication',
              priority: 'critical',
              description: 'Complete user registration, login, and logout flow'
            },
            {
              name: 'Product Catalog API',
              category: 'api',
              priority: 'high',
              description: 'Product CRUD operations and search functionality'
            },
            {
              name: 'Payment Processing',
              category: 'workflow',
              priority: 'critical',
              description: 'End-to-end payment processing workflow'
            },
            {
              name: 'Database Transactions',
              category: 'database',
              priority: 'high',
              description: 'Database consistency and transaction handling'
            }
          ],
          setupScripts: [
            'npm install --save-dev jest supertest',
            'npm install --save-dev @types/jest @types/supertest'
          ],
          estimatedDuration: 15
        },
        summary: 'Generated comprehensive test suite with 4 critical scenarios',
        recommendations: [
          '🔍 Start with authentication flow tests',
          '📝 Implement test data factories',
          '⚡ Consider parallel test execution'
        ]
      }
    }));
    setIsLoading(false);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-4 w-4" />;
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <AlertTriangle className="h-4 w-4" />;
      case 'low': return <CheckCircle className="h-4 w-4" />;
      default: return <CheckCircle className="h-4 w-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI Advanced Features Demo</h1>
        <p className="text-muted-foreground">
          Explore the cutting-edge AI capabilities integrated into the VibeCode platform
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="test-generation">Test Generation</TabsTrigger>
          <TabsTrigger value="code-completion">Code Completion</TabsTrigger>
          <TabsTrigger value="nl-to-code">NL to Code</TabsTrigger>
          <TabsTrigger value="code-review">Code Review</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="integration">Integration</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5" />
                  Automated Test Generation
                </CardTitle>
                <CardDescription>
                  AI-powered test suite generation with comprehensive coverage analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Automatically generate unit tests, integration tests, and test data based on your code.
                </p>
                <Badge variant="secondary">Jest</Badge>
                <Badge variant="secondary">React Testing Library</Badge>
                <Badge variant="secondary">Coverage Analysis</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Smart Code Completion
                </CardTitle>
                <CardDescription>
                  Context-aware code suggestions and intelligent autocompletion
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Get intelligent code suggestions based on context, patterns, and best practices.
                </p>
                <Badge variant="secondary">Context Aware</Badge>
                <Badge variant="secondary">Pattern Recognition</Badge>
                <Badge variant="secondary">Best Practices</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Natural Language to Code
                </CardTitle>
                <CardDescription>
                  Convert natural language descriptions into working code
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Describe what you want in plain English and get production-ready code.
                </p>
                <Badge variant="secondary">Multi-language</Badge>
                <Badge variant="secondary">Documentation</Badge>
                <Badge variant="secondary">Test Generation</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Code Review Automation
                </CardTitle>
                <CardDescription>
                  Automated security, quality, and best practices analysis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Automated code review with security vulnerability detection and quality checks.
                </p>
                <Badge variant="secondary">Security</Badge>
                <Badge variant="secondary">Quality</Badge>
                <Badge variant="secondary">Best Practices</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  Performance Optimization
                </CardTitle>
                <CardDescription>
                  Identify and fix performance bottlenecks automatically
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Detect performance issues, memory leaks, and optimization opportunities.
                </p>
                <Badge variant="secondary">Algorithm Analysis</Badge>
                <Badge variant="secondary">Memory Leaks</Badge>
                <Badge variant="secondary">Optimization Score</Badge>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Integration Testing
                </CardTitle>
                <CardDescription>
                  Generate comprehensive integration test suites
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  AI-generated integration tests for complex system interactions and workflows.
                </p>
                <Badge variant="secondary">API Testing</Badge>
                <Badge variant="secondary">Workflow Testing</Badge>
                <Badge variant="secondary">Test Templates</Badge>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="test-generation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Automated Test Generation</CardTitle>
              <CardDescription>
                Generate comprehensive test suites for your code automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="test-code">Code to Test</Label>
                <Textarea
                  id="test-code"
                  value={testCode}
                  onChange={(e) => setTestCode(e.target.value)}
                  placeholder="Paste your code here..."
                  rows={8}
                />
              </div>
              <Button onClick={handleTestGeneration} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <TestTube className="mr-2 h-4 w-4" />}
                Generate Tests
              </Button>

              {results.testGeneration && (
                <div className="space-y-4">
                  <Alert>
                    <CheckCircle className="h-4 w-4" />
                    <AlertDescription>
                      Generated {results.testGeneration.tests.length} tests with {results.testGeneration.coverage} coverage
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    {results.testGeneration.tests.map((test: any, index: number) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-sm">{test.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                            <code>{test.code}</code>
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {results.testGeneration.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code-completion" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Smart Code Completion</CardTitle>
              <CardDescription>
                Get intelligent code suggestions based on context and patterns
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="completion-prompt">What would you like to create?</Label>
                  <Textarea
                    id="completion-prompt"
                    value={completionPrompt}
                    onChange={(e) => setCompletionPrompt(e.target.value)}
                    placeholder="Describe what you want to build..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="language-select">Programming Language</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="typescript">TypeScript</SelectItem>
                      <SelectItem value="javascript">JavaScript</SelectItem>
                      <SelectItem value="python">Python</SelectItem>
                      <SelectItem value="java">Java</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCodeCompletion} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                Generate Code
              </Button>

              {results.codeCompletion && (
                <div className="space-y-4">
                  <Alert>
                    <Lightbulb className="h-4 w-4" />
                    <AlertDescription>
                      Generated {results.codeCompletion.suggestions.length} code suggestions
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    {results.codeCompletion.suggestions.map((suggestion: any, index: number) => (
                      <Card key={index}>
                        <CardHeader>
                          <CardTitle className="text-sm capitalize">{suggestion.type} Suggestion</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                            <code>{suggestion.code}</code>
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="nl-to-code" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Natural Language to Code</CardTitle>
              <CardDescription>
                Convert plain English descriptions into working code
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="nl-prompt">Describe what you want to build</Label>
                <Textarea
                  id="nl-prompt"
                  value={nlPrompt}
                  onChange={(e) => setNlPrompt(e.target.value)}
                  placeholder="Describe your requirements in plain English..."
                  rows={4}
                />
              </div>
              <Button onClick={handleNaturalLanguageToCode} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                Generate Code
              </Button>

              {results.naturalLanguageToCode && (
                <div className="space-y-4">
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Generated code with tests and documentation
                    </AlertDescription>
                  </Alert>

                  <Tabs defaultValue="code" className="w-full">
                    <TabsList>
                      <TabsTrigger value="code">Code</TabsTrigger>
                      <TabsTrigger value="tests">Tests</TabsTrigger>
                      <TabsTrigger value="docs">Documentation</TabsTrigger>
                    </TabsList>
                    <TabsContent value="code">
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                        <code>{results.naturalLanguageToCode.code}</code>
                      </pre>
                    </TabsContent>
                    <TabsContent value="tests">
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                        <code>{results.naturalLanguageToCode.tests}</code>
                      </pre>
                    </TabsContent>
                    <TabsContent value="docs">
                      <pre className="bg-muted p-4 rounded text-sm overflow-x-auto">
                        <code>{results.naturalLanguageToCode.documentation}</code>
                      </pre>
                    </TabsContent>
                  </Tabs>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="code-review" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Code Review Automation</CardTitle>
              <CardDescription>
                Automated security, quality, and best practices analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="review-code">Code to Review</Label>
                <Textarea
                  id="review-code"
                  value={reviewCode}
                  onChange={(e) => setReviewCode(e.target.value)}
                  placeholder="Paste code for automated review..."
                  rows={8}
                />
              </div>
              <Button onClick={handleCodeReview} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Shield className="mr-2 h-4 w-4" />}
                Review Code
              </Button>

              {results.codeReview && (
                <div className="space-y-4">
                  <Alert>
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      {results.codeReview.summary}
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-4">
                    {results.codeReview.issues.map((issue: any, index: number) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm flex items-center gap-2">
                              {getSeverityIcon(issue.severity)}
                              {issue.message}
                            </CardTitle>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                          </div>
                          <CardDescription>
                            Line {issue.lineNumber} • {issue.category}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-2">{issue.impact}</p>
                          <p className="text-sm font-medium">Suggestion:</p>
                          <p className="text-sm text-muted-foreground">{issue.suggestion}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Recommendations</h4>
                    <ul className="space-y-1">
                      {results.codeReview.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance Optimization</CardTitle>
              <CardDescription>
                Identify and fix performance bottlenecks automatically
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="performance-code">Code to Analyze</Label>
                <Textarea
                  id="performance-code"
                  value={performanceCode}
                  onChange={(e) => setPerformanceCode(e.target.value)}
                  placeholder="Paste code for performance analysis..."
                  rows={8}
                />
              </div>
              <Button onClick={handlePerformanceAnalysis} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gauge className="mr-2 h-4 w-4" />}
                Analyze Performance
              </Button>

              {results.performanceAnalysis && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Alert>
                      <Gauge className="h-4 w-4" />
                      <AlertDescription>
                        {results.performanceAnalysis.summary}
                      </AlertDescription>
                    </Alert>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{results.performanceAnalysis.optimizationScore}</div>
                      <div className="text-sm text-muted-foreground">Optimization Score</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {results.performanceAnalysis.issues.map((issue: any, index: number) => (
                      <Card key={index} className="border-l-4 border-l-orange-500">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-sm">{issue.title}</CardTitle>
                            <Badge className={getSeverityColor(issue.severity)}>
                              {issue.severity}
                            </Badge>
                          </div>
                          <CardDescription>
                            {issue.type} • {issue.description}
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm mb-2">{issue.suggestion}</p>
                          <p className="text-sm text-muted-foreground">
                            Estimated improvement: {issue.estimatedImprovement}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Optimization Recommendations</h4>
                    <ul className="space-y-1">
                      {results.performanceAnalysis.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integration" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Testing</CardTitle>
              <CardDescription>
                Generate comprehensive integration test suites for complex systems
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="system-description">System Description</Label>
                  <Textarea
                    id="system-description"
                    value={systemDescription}
                    onChange={(e) => setSystemDescription(e.target.value)}
                    placeholder="Describe your system..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="components">System Components</Label>
                  <Textarea
                    id="components"
                    value={components}
                    onChange={(e) => setComponents(e.target.value)}
                    placeholder="List main components..."
                    rows={4}
                  />
                </div>
              </div>
              <Button onClick={handleIntegrationTesting} disabled={isLoading}>
                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                Generate Test Suite
              </Button>

              {results.integrationTesting && (
                <div className="space-y-4">
                  <Alert>
                    <Database className="h-4 w-4" />
                    <AlertDescription>
                      {results.integrationTesting.summary}
                    </AlertDescription>
                  </Alert>

                  <Card>
                    <CardHeader>
                      <CardTitle>{results.integrationTesting.testSuite.name}</CardTitle>
                      <CardDescription>
                        Estimated duration: {results.integrationTesting.testSuite.estimatedDuration} minutes
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <h4 className="font-semibold">Test Scenarios</h4>
                        {results.integrationTesting.testSuite.scenarios.map((scenario: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <div className="font-medium">{scenario.name}</div>
                              <div className="text-sm text-muted-foreground">{scenario.description}</div>
                            </div>
                            <div className="flex gap-2">
                              <Badge variant="outline">{scenario.category}</Badge>
                              <Badge className={getSeverityColor(scenario.priority)}>
                                {scenario.priority}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4">
                        <h4 className="font-semibold mb-2">Setup Scripts</h4>
                        <div className="space-y-1">
                          {results.integrationTesting.testSuite.setupScripts.map((script: string, index: number) => (
                            <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                              {script}
                            </div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <div>
                    <h4 className="font-semibold mb-2">Implementation Recommendations</h4>
                    <ul className="space-y-1">
                      {results.integrationTesting.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="text-sm text-muted-foreground">• {rec}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
