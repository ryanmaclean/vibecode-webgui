'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader, CheckCircle, TriangleAlert as AlertTriangle, Info, Code, Shield, Zap, BookOpen } from 'lucide-react';
// import { logger } from '@/lib/logger';
// import { EnhancedAIManager } from '@/lib/ai/enhanced-ai-manager';

interface CodeReviewResult {
  stepId: string;
  agentRole: string;
  input: string;
  output: string;
  metadata: {
    model: string;
    duration: number;
    timestamp: string;
  };
}

interface CodeReviewProps {
  code: string;
  language?: string;
  framework?: string;
  onReviewComplete?: (results: CodeReviewResult[]) => void;
  className?: string;
}

export default function AICodeReview({
  code,
  language = 'typescript',
  framework,
  onReviewComplete,
  className = ''
}: CodeReviewProps) {
  const [isReviewing, setIsReviewing] = useState(false);
  const [results, setResults] = useState<CodeReviewResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('security');

  // Initialize AI Manager
  // const aiManager = new EnhancedAIManager({
  //   openai: {
  //     apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY || '',
  //     model: 'gpt-4',
  //     temperature: 0.1
  //   }
  // });

  const handleCodeReview = useCallback(async () => {
    if (!code.trim()) return;

    setIsReviewing(true);
    setError(null);
    setResults([]);

    try {
      // const request = {
      //   type: 'code-review' as const,
      //   requirements: `Review this ${language} code${framework ? ` using ${framework}` : ''} for security, performance, and quality issues`,
      //   language,
      //   framework
      // };

      // const response = await aiManager.executeWorkflow(request);

      // if (response.success) {
      //   setResults(response.results);
      //   onReviewComplete?.(response.results);
      // } else {
      //   throw new Error(response.error || 'Code review failed');
      // }

      // Temporary mock response for testing
      const mockResults: CodeReviewResult[] = [
        {
          stepId: 'security-review',
          agentRole: 'code-reviewer',
          input: code,
          output: 'Mock security review - LangChain temporarily disabled',
          metadata: {
            model: 'mock',
            duration: 100,
            timestamp: new Date().toISOString()
          }
        },
        {
          stepId: 'performance-review',
          agentRole: 'code-reviewer',
          input: code,
          output: 'Mock performance review - LangChain temporarily disabled',
          metadata: {
            model: 'mock',
            duration: 100,
            timestamp: new Date().toISOString()
          }
        },
        {
          stepId: 'quality-review',
          agentRole: 'code-reviewer',
          input: code,
          output: 'Mock quality review - LangChain temporarily disabled',
          metadata: {
            model: 'mock',
            duration: 100,
            timestamp: new Date().toISOString()
          }
        },
        {
          stepId: 'comprehensive-review',
          agentRole: 'code-reviewer',
          input: code,
          output: 'Mock comprehensive review - LangChain temporarily disabled',
          metadata: {
            model: 'mock',
            duration: 100,
            timestamp: new Date().toISOString()
          }
        }
      ];
      setResults(mockResults);
      onReviewComplete?.(mockResults);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during code review');
      console.error('Code review error:', err);
    } finally {
      setIsReviewing(false);
    }
  }, [code, language, framework, onReviewComplete]);

  const getReviewSection = (stepId: string) => {
    return results.find(result => result.stepId === stepId);
  };

  const getSeverityColor = (stepId: string): 'default' | 'destructive' | 'outline' | 'secondary' => {
    const result = getReviewSection(stepId);
    if (!result) return 'default';

    const output = result.output.toLowerCase();
    if (output.includes('critical') || output.includes('high risk')) return 'destructive';
    if (output.includes('warning') || output.includes('medium risk')) return 'secondary';
    if (output.includes('suggestion') || output.includes('low risk')) return 'outline';
    return 'default';
  };

  const getSeverityIcon = (stepId: string) => {
    const result = getReviewSection(stepId);
    if (!result) return <Info className="h-4 w-4" />;

    const output = result.output.toLowerCase();
    if (output.includes('critical') || output.includes('high risk')) return <AlertTriangle className="h-4 w-4" />;
    if (output.includes('warning') || output.includes('medium risk')) return <AlertTriangle className="h-4 w-4" />;
    if (output.includes('suggestion') || output.includes('low risk')) return <Info className="h-4 w-4" />;
    return <CheckCircle className="h-4 w-4" />;
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            AI-Powered Code Review
          </CardTitle>
          <CardDescription>
            Comprehensive code analysis using AI agents for security, performance, and quality review
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{language}</Badge>
            {framework && <Badge variant="outline">{framework}</Badge>}
            <Badge variant="outline">{code.split('\n').length} lines</Badge>
          </div>

          <Button
            onClick={handleCodeReview}
            disabled={isReviewing || !code.trim()}
            className="w-full"
          >
            {isReviewing ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Reviewing Code...
              </>
            ) : (
              <>
                <Shield className="mr-2 h-4 w-4" />
                Start Code Review
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Review Results</CardTitle>
            <CardDescription>
              AI analysis completed in {results[0]?.metadata.duration}ms using {results[0]?.metadata.model}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={selectedTab} onValueChange={setSelectedTab}>
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="security" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Security
                </TabsTrigger>
                <TabsTrigger value="performance" className="flex items-center gap-2">
                  <Zap className="h-4 w-4" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="quality" className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Quality
                </TabsTrigger>
                <TabsTrigger value="summary" className="flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Summary
                </TabsTrigger>
              </TabsList>

              <TabsContent value="security" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor('security-review')}>
                      {getSeverityIcon('security-review')}
                      Security Review
                    </Badge>
                  </div>
                  {getReviewSection('security-review') ? (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md">
                        {getReviewSection('security-review')?.output}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Security review not available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor('performance-review')}>
                      {getSeverityIcon('performance-review')}
                      Performance Review
                    </Badge>
                  </div>
                  {getReviewSection('performance-review') ? (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md">
                        {getReviewSection('performance-review')?.output}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Performance review not available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor('quality-review')}>
                      {getSeverityIcon('quality-review')}
                      Quality Review
                    </Badge>
                  </div>
                  {getReviewSection('quality-review') ? (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md">
                        {getReviewSection('quality-review')?.output}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Quality review not available</p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={getSeverityColor('comprehensive-review')}>
                      {getSeverityIcon('comprehensive-review')}
                      Comprehensive Summary
                    </Badge>
                  </div>
                  {getReviewSection('comprehensive-review') ? (
                    <div className="prose prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap bg-muted p-3 rounded-md">
                        {getReviewSection('comprehensive-review')?.output}
                      </pre>
                    </div>
                  ) : (
                    <p className="text-muted-foreground">Comprehensive summary not available</p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
