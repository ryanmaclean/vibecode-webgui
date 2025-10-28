using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.ChatCompletion;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System.ComponentModel;

namespace VibeCode.SemanticKernel.BasicAgent;

/// <summary>
/// Basic Semantic Kernel Agent for VibeCode Platform
/// Demonstrates fundamental AI agent capabilities with OpenAI integration
/// </summary>
class Program
{
    static async Task Main(string[] args)
    {
        // Initialize logging
        using var loggerFactory = LoggerFactory.Create(builder =>
        {
            builder.AddConsole().SetMinimumLevel(LogLevel.Information);
        });
        var logger = loggerFactory.CreateLogger<Program>();

        try
        {
            logger.LogInformation("🚀 Starting VibeCode Semantic Kernel Basic Agent...");

            // Create kernel builder
            var builder = Kernel.CreateBuilder();

            // Configure AI service (OpenAI or Azure OpenAI)
            var openAiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
            var azureEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT");
            var azureKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY");

            if (!string.IsNullOrEmpty(azureEndpoint) && !string.IsNullOrEmpty(azureKey))
            {
                logger.LogInformation("🔗 Configuring Azure OpenAI connection...");
                builder.AddAzureOpenAIChatCompletion(
                    deploymentName: "gpt-4", // or your deployment name
                    endpoint: azureEndpoint,
                    apiKey: azureKey);
            }
            else if (!string.IsNullOrEmpty(openAiKey))
            {
                logger.LogInformation("🔗 Configuring OpenAI connection...");
                builder.AddOpenAIChatCompletion(
                    modelId: "gpt-4",
                    apiKey: openAiKey);
            }
            else
            {
                throw new InvalidOperationException("❌ No AI service configuration found. Please set OPENAI_API_KEY or Azure OpenAI environment variables.");
            }

            // Add logging
            builder.Services.AddLogging(b => b.AddConsole().SetMinimumLevel(LogLevel.Information));

            // Build the kernel
            var kernel = builder.Build();

            // Add plugins
            kernel.ImportPluginFromType<VibeCodePlugin>();
            kernel.ImportPluginFromType<TimePlugin>();

            logger.LogInformation("✅ Kernel initialized with plugins: VibeCodePlugin, TimePlugin");

            // Get chat completion service
            var chatCompletionService = kernel.GetRequiredService<IChatCompletionService>();

            // Start interactive chat
            logger.LogInformation("🤖 VibeCode AI Agent is ready! Type 'exit' to quit.");
            Console.WriteLine("\n" + new string('=', 60));
            Console.WriteLine("🎯 VibeCode AI Development Assistant");
            Console.WriteLine("💡 I can help with code generation, reviews, and development tasks");
            Console.WriteLine("🔧 Available tools: Time, Weather, Code Analysis");
            Console.WriteLine(new string('=', 60) + "\n");

            var chatHistory = new ChatHistory();
            chatHistory.AddSystemMessage(@"
You are an expert AI development assistant for the VibeCode platform. You help developers with:
- Code generation and review
- Architecture decisions  
- Best practices
- Debugging assistance
- Project scaffolding
- Testing strategies

Be helpful, concise, and always consider security and performance. Use the available tools when appropriate.
");

            while (true)
            {
                Console.Write("👤 You: ");
                var userInput = Console.ReadLine();

                if (string.IsNullOrWhiteSpace(userInput))
                    continue;

                if (userInput.ToLower() is "exit" or "quit" or "bye")
                {
                    Console.WriteLine("🤖 Agent: Goodbye! Happy coding! 🚀");
                    break;
                }

                chatHistory.AddUserMessage(userInput);

                try
                {
                    Console.Write("🤖 Agent: ");
                    
                    // Enable function calling for tool usage
                    var executionSettings = new OpenAIPromptExecutionSettings()
                    {
                        ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                        Temperature = 0.7,
                        MaxTokens = 1000
                    };

                    // Stream the response
                    var response = "";
                    await foreach (var content in chatCompletionService.GetStreamingChatMessageContentsAsync(
                        chatHistory, executionSettings, kernel))
                    {
                        Console.Write(content.Content);
                        response += content.Content;
                    }

                    Console.WriteLine("\n");
                    chatHistory.AddAssistantMessage(response);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "❌ Error during chat completion");
                    Console.WriteLine($"❌ Error: {ex.Message}\n");
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "💥 Fatal error in Basic Agent");
            Console.WriteLine($"💥 Fatal Error: {ex.Message}");
            Environment.Exit(1);
        }
    }
}

/// <summary>
/// VibeCode-specific plugin for development assistance
/// </summary>
public class VibeCodePlugin
{
    [KernelFunction("generate_component")]
    [Description("Generate a React component based on specifications")]
    public string GenerateComponent(
        [Description("Component name")] string componentName,
        [Description("Component description")] string description,
        [Description("Props needed")] string props = "")
    {
        var template = $@"
import React from 'react';
import {{ FC }} from 'react';

interface {componentName}Props {{
  {(string.IsNullOrEmpty(props) ? "// Add props here" : props)}
}}

export const {componentName}: FC<{componentName}Props> = (props) => {{
  return (
    <div className=""{componentName.ToLower()}"">
      <h2>{description}</h2>
      {{/* Component implementation */}}
    </div>
  );
}};

export default {componentName};
";
        
        return template.Trim();
    }

    [KernelFunction("analyze_code")]
    [Description("Analyze code for potential issues and improvements")]
    public string AnalyzeCode([Description("Code to analyze")] string code)
    {
        var issues = new List<string>();
        
        // Basic static analysis
        if (code.Contains("var "))
            issues.Add("Consider using 'const' or 'let' instead of 'var'");
        
        if (code.Contains("==") && !code.Contains("==="))
            issues.Add("Consider using '===' for strict equality");
        
        if (code.Contains("innerHTML"))
            issues.Add("Be cautious with innerHTML - consider security implications");
        
        if (!code.Contains("export"))
            issues.Add("Consider adding proper module exports");

        var analysis = issues.Any() 
            ? $"🔍 Code Analysis Results:\n• {string.Join("\n• ", issues)}"
            : "✅ Code looks good! No major issues detected.";

        return analysis;
    }

    [KernelFunction("suggest_tests")]
    [Description("Suggest test cases for given code")]
    public string SuggestTests([Description("Code to test")] string code)
    {
        return @"
🧪 Suggested Test Cases:

1. **Unit Tests:**
   - Test with valid inputs
   - Test with invalid/null inputs
   - Test edge cases
   - Test error handling

2. **Integration Tests:**
   - Test component interactions
   - Test API integrations
   - Test data flow

3. **E2E Tests:**
   - Test user workflows
   - Test accessibility
   - Test performance

Use Jest and React Testing Library for React components.
";
    }
}

/// <summary>
/// Time-related plugin for scheduling and temporal operations
/// </summary>
public class TimePlugin
{
    [KernelFunction("get_current_time")]
    [Description("Get the current date and time")]
    public string GetCurrentTime()
    {
        return DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss UTC");
    }

    [KernelFunction("calculate_duration")]
    [Description("Calculate duration between two dates")]
    public string CalculateDuration(
        [Description("Start date (YYYY-MM-DD)")] string startDate,
        [Description("End date (YYYY-MM-DD)")] string endDate)
    {
        try
        {
            var start = DateTime.Parse(startDate);
            var end = DateTime.Parse(endDate);
            var duration = end - start;
            
            return $"Duration: {duration.Days} days, {duration.Hours} hours, {duration.Minutes} minutes";
        }
        catch
        {
            return "❌ Invalid date format. Please use YYYY-MM-DD.";
        }
    }

    [KernelFunction("format_date")]
    [Description("Format a date string into different formats")]
    public string FormatDate(
        [Description("Input date")] string inputDate,
        [Description("Output format (e.g., 'MM/dd/yyyy', 'dd-MM-yyyy')")] string format = "yyyy-MM-dd")
    {
        try
        {
            var date = DateTime.Parse(inputDate);
            return date.ToString(format);
        }
        catch
        {
            return "❌ Invalid date format.";
        }
    }
}