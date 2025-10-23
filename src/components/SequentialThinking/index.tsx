'use client';

import { useState } from 'react';
import useSequentialThinking from '@/hooks/useSequentialThinking';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Loader } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
// import { logger } from '@/lib/logger';
export function SequentialThinking() {
  const [prompt, setPrompt] = useState('');
  const [numSteps, setNumSteps] = useState(5);
  const { think, thoughts, isLoading, error, isFallback, reset } = useSequentialThinking();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    
    try {
      await think({ prompt, numSteps });
    } catch (err) {
      // Error is handled by the hook
      console.error('Failed to process thinking:', err);
    }
  };

  const handleReset = () => {
    setPrompt('');
    reset();
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6 flex items-center gap-2">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-8 w-8"
        >
          <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
          <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
          <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
        </svg>
        Sequential Thinking
      </h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Break Down Complex Problems</CardTitle>
          <CardDescription>
            Enter a problem or question to decompose it into structured thinking steps
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="prompt" className="text-sm font-medium">
                Problem or Question
              </label>
              <Input
                id="prompt"
                placeholder="Enter a complex problem or question..."
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={isLoading}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="numSteps" className="text-sm font-medium">
                  Number of Thinking Steps: {numSteps}
                </label>
                <span className="text-sm text-gray-500">(3-10 recommended)</span>
              </div>
              <Slider
                id="numSteps"
                min={3}
                max={10}
                step={1}
                value={[numSteps]}
                onValueChange={(value) => setNumSteps(value[0])}
                disabled={isLoading}
                className="w-full"
              />
            </div>
          </form>
        </CardContent>
        
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleReset}
            disabled={isLoading || (!prompt && thoughts.length === 0)}
          >
            Reset
          </Button>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={isLoading || !prompt.trim()}
            className="ml-2"
          >
            {isLoading ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Thinking...
              </>
            ) : (
              'Think Sequentially'
            )}
          </Button>
        </CardFooter>
      </Card>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {isFallback && (
        <Alert className="mb-6 bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertTitle className="text-yellow-700">Fallback Mode</AlertTitle>
          <AlertDescription className="text-yellow-600">
            Using fallback mode as the MCP server could not be reached. This is a simulated response.
          </AlertDescription>
        </Alert>
      )}

      {thoughts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Thinking Process</CardTitle>
            <CardDescription>
              Structured breakdown of "{prompt}"
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {thoughts.map((thought, index) => (
              <div key={index} className="relative">
                {thought.type === 'thought' ? (
                  <div className="pl-8 border-l-2 border-primary pb-4 relative">
                    <div className="absolute top-0 left-[-9px] w-4 h-4 rounded-full bg-primary" />
                    <div className="mb-1">
                      <Badge variant="outline" className="mb-2">
                        Step {index + 1}
                      </Badge>
                    </div>
                    <p className="text-gray-800">{thought.text}</p>
                  </div>
                ) : (
                  <>
                    <Separator className="my-4" />
                    <div className="bg-slate-50 p-4 rounded-md">
                      <h3 className="font-semibold mb-2">Conclusion</h3>
                      <p>{thought.text}</p>
                    </div>
                  </>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default SequentialThinking;