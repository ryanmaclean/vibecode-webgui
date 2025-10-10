'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
// Temporarily disabled to fix build issues - TODO: Fix LangChain compatibility
// import AICodeReview from '@/components/ai/AICodeReview';

const SAMPLE_CODES = {
  typescript: `// Sample TypeScript code with potential issues
interface User {
  id: string;
  name: string;
  email: string;
  password: string; // Security issue: plain text password
}

class UserService {
  private users: User[] = [];

  async createUser(userData: Partial<User>): Promise<User> {
    // Missing validation
    const user: User = {
      id: Math.random().toString(), // Security issue: predictable ID
      name: userData.name || '',
      email: userData.email || '',
      password: userData.password || '' // Security issue: no hashing
    };

    this.users.push(user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    // Performance issue: O(n) search
    return this.users.find(user => user.id === id) || null;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    const userIndex = this.users.findIndex(user => user.id === id);
    if (userIndex === -1) return null;

    // Security issue: direct assignment without validation
    Object.assign(this.users[userIndex], updates);
    return this.users[userIndex];
  }
}

// Usage example
const userService = new UserService();
userService.createUser({
  name: 'John Doe',
  email: 'john@example.com',
  password: 'password123' // Security issue: weak password
});`,

  javascript: `// Sample JavaScript code with potential issues
function processUserData(userData) {
  // Missing input validation
  if (!userData) return null;

  // Security issue: eval usage (now safely commented out)
  // const processedData = eval('(' + userData + ')');
  const processedData = JSON.parse(userData); // Safe alternative

  // Performance issue: nested loops
  for (let i = 0; i < processedData.length; i++) {
    for (let j = 0; j < processedData[i].items.length; j++) {
      for (let k = 0; k < processedData[i].items[j].details.length; k++) {
        console.log(processedData[i].items[j].details[k]);
      }
    }
  }

  // Security issue: innerHTML (now safely commented out)
  // document.getElementById('output').innerHTML = processedData.html;
  const outputElement = document.getElementById('output');
  if (outputElement) outputElement.textContent = processedData.html; // Safe alternative

  return processedData;
}

// Global variable pollution
var globalVar = 'I am global';

// Missing error handling
function fetchData(url) {
  fetch(url)
    .then(response => response.json())
    .then(data => console.log(data));
}`,

  python: `# Sample Python code with potential issues
import os
import subprocess
import pickle

class UserManager:
    def __init__(self):
        self.users = {}
    
    def add_user(self, username, password):
        # Security issue: plain text password storage
        self.users[username] = password
    
    def authenticate(self, username, password):
        # Security issue: timing attack vulnerability
        return self.users.get(username) == password
    
    def load_users_from_file(self, filename):
        # Security issue: pickle can execute arbitrary code
        with open(filename, 'rb') as f:
            self.users = pickle.load(f)
    
    def execute_command(self, command):
        # Security issue: command injection
        os.system(command)
    
    def run_sql_query(self, query):
        # Security issue: SQL injection
        cursor.execute(query)
    
    def process_data(self, data):
        # Performance issue: inefficient string concatenation
        result = ""
        for item in data:
            result += str(item)  # Creates new string each iteration
        return result

# Global variable pollution
global_var = "I am global"

# Missing error handling
def divide_numbers(a, b):
    return a / b  # Will crash if b is 0`
};

const FRAMEWORKS = {
  typescript: ['React', 'Next.js', 'Angular', 'Vue', 'Express', 'NestJS'],
  javascript: ['React', 'Next.js', 'Angular', 'Vue', 'Express', 'Node.js'],
  python: ['Django', 'Flask', 'FastAPI', 'PyTorch', 'TensorFlow', 'Pandas']
};

export default function AICodeReviewDemo() {
  const [selectedLanguage, setSelectedLanguage] = useState('typescript');
  const [selectedFramework, setSelectedFramework] = useState('');
  const [customCode, setCustomCode] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);

  const currentSampleCode = useCustomCode ? customCode : SAMPLE_CODES[selectedLanguage as keyof typeof SAMPLE_CODES] || '';

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">AI-Powered Code Review Demo</h1>
        <p className="text-xl text-muted-foreground">
          Experience advanced AI-driven code analysis with security, performance, and quality insights
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Code Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Code Input</CardTitle>
            <CardDescription>
              Select sample code or input your own code for AI review
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Programming Language</Label>
              <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                <SelectTrigger>
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="typescript">TypeScript</SelectItem>
                  <SelectItem value="javascript">JavaScript</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="framework">Framework (Optional)</Label>
              <Select value={selectedFramework} onValueChange={setSelectedFramework}>
                <SelectTrigger>
                  <SelectValue placeholder="Select framework" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">None</SelectItem>
                  {FRAMEWORKS[selectedLanguage as keyof typeof FRAMEWORKS]?.map(framework => (
                    <SelectItem key={framework} value={framework.toLowerCase()}>
                      {framework}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="useCustomCode"
                  checked={useCustomCode}
                  onChange={(e) => setUseCustomCode(e.target.checked)}
                  className="rounded"
                />
                <Label htmlFor="useCustomCode">Use custom code</Label>
              </div>
            </div>

            {useCustomCode && (
              <div className="space-y-2">
                <Label htmlFor="customCode">Custom Code</Label>
                <Textarea
                  id="customCode"
                  value={customCode}
                  onChange={(e) => setCustomCode(e.target.value)}
                  placeholder="Paste your code here..."
                  rows={15}
                  className="font-mono text-sm"
                />
              </div>
            )}

            {!useCustomCode && (
              <div className="space-y-2">
                <Label>Sample Code</Label>
                <div className="bg-muted p-4 rounded-md">
                  <pre className="text-sm font-mono whitespace-pre-wrap">
                    {currentSampleCode}
                  </pre>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{selectedLanguage}</Badge>
                  {selectedFramework && <Badge variant="outline">{selectedFramework}</Badge>}
                  <Badge variant="outline">{currentSampleCode.split('\n').length} lines</Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* AI Code Review Section - Temporarily disabled */}
        <div className="space-y-4">
          <div className="p-6 border border-yellow-300 bg-yellow-50 rounded-lg">
            <h3 className="text-lg font-semibold text-yellow-800 mb-2">Feature Temporarily Disabled</h3>
            <p className="text-yellow-700">
              The AI Code Review feature is temporarily disabled while we fix compatibility issues. 
              This will be restored in the next update.
            </p>
          </div>
          {/* <AICodeReview
            code={currentSampleCode}
            language={selectedLanguage}
            framework={selectedFramework}
            onReviewComplete={(results) => {
              console.log('Code review completed:', results);
            }}
          /> */}
        </div>
      </div>

      {/* Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>AI Code Review Features</CardTitle>
          <CardDescription>
            Comprehensive analysis powered by multiple AI agents
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="security" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="security">Security Analysis</TabsTrigger>
              <TabsTrigger value="performance">Performance Review</TabsTrigger>
              <TabsTrigger value="quality">Code Quality</TabsTrigger>
              <TabsTrigger value="summary">Comprehensive Report</TabsTrigger>
            </TabsList>

            <TabsContent value="security" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Vulnerability Detection</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• SQL injection vulnerabilities</li>
                    <li>• Command injection risks</li>
                    <li>• XSS and CSRF issues</li>
                    <li>• Insecure data handling</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Security Best Practices</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Input validation patterns</li>
                    <li>• Authentication security</li>
                    <li>• Data encryption requirements</li>
                    <li>• Secure coding guidelines</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Performance Issues</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Algorithmic complexity</li>
                    <li>• Memory usage patterns</li>
                    <li>• Database query optimization</li>
                    <li>• Resource management</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Optimization Suggestions</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Caching strategies</li>
                    <li>• Lazy loading patterns</li>
                    <li>• Efficient data structures</li>
                    <li>• Performance monitoring</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="quality" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="font-semibold">Code Structure</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Architecture patterns</li>
                    <li>• Design principles</li>
                    <li>• Code organization</li>
                    <li>• Maintainability</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h4 className="font-semibold">Best Practices</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Naming conventions</li>
                    <li>• Documentation standards</li>
                    <li>• Testing coverage</li>
                    <li>• Error handling</li>
                  </ul>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="summary" className="space-y-4">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  The AI code review system provides a comprehensive analysis combining all review aspects:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">Security</div>
                    <div className="text-sm text-muted-foreground">Vulnerability assessment</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-green-600">Performance</div>
                    <div className="text-sm text-muted-foreground">Optimization insights</div>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">Quality</div>
                    <div className="text-sm text-muted-foreground">Best practices review</div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
