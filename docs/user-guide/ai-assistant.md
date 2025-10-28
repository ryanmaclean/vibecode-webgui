# Using the AI Assistant

Your built-in AI coding helper can answer questions, explain code, and assist with programming tasks.

## What Can the AI Assistant Do?

The AI assistant is like having a knowledgeable coding tutor available 24/7. It can:

- **Answer programming questions** - "How do I create a loop in Python?"
- **Explain code** - "What does this function do?"
- **Debug errors** - "Why am I getting this error message?"
- **Write code snippets** - "Show me how to read a file"
- **Suggest improvements** - "How can I make this code better?"
- **Teach concepts** - "Explain what a variable is"

## Opening the AI Assistant

### In a Workspace

1. Look for the AI icon in the right sidebar
2. Click to open the chat panel
3. Start typing your question

[Screenshot: AI assistant icon location and open panel]

### Keyboard Shortcut

- Press `Ctrl+K` (Windows/Linux) or `Cmd+K` (Mac) to quickly open the assistant

## Asking for Help

### How to Ask Good Questions

The better your question, the better the answer you'll get.

**Good Questions:**
- "How do I add two numbers in Python?"
- "Explain what this error means: TypeError: cannot concatenate 'str' and 'int'"
- "Show me how to create a function that sorts a list"

**Less Helpful Questions:**
- "Help" (too vague)
- "Fix this" (no context)
- "Why doesn't it work?" (no specific details)

### Question Formula

Try this structure:

```
What I want to do: [your goal]
What I've tried: [your attempt]
What happened: [the result or error]
```

Example:
```
What I want to do: Read a CSV file in Python
What I've tried: import csv
What happened: Not sure what to do next
```

💡 **Tip**: Include error messages exactly as they appear. The AI can help diagnose the problem.

## Getting Code Help

### Explaining Code

**Copy and paste code**, then ask:
- "What does this code do?"
- "Explain this line by line"
- "Why is this function needed?"

Example:
```
Can you explain this code?

def greet(name):
    return f"Hello, {name}!"

print(greet("Alice"))
```

The AI will break it down in simple terms.

### Writing New Code

Ask the AI to generate code for you:

**Request:**
"Write a Python function that calculates the average of a list of numbers"

**Response:**
```python
def calculate_average(numbers):
    if len(numbers) == 0:
        return 0
    return sum(numbers) / len(numbers)

# Example usage:
my_numbers = [10, 20, 30, 40]
avg = calculate_average(my_numbers)
print(f"Average: {avg}")
```

### Understanding Errors

When you get an error:

1. **Copy the complete error message**
2. **Paste it in the chat**
3. **Include the code that caused it**
4. **Ask for help**

Example:
```
I got this error:

NameError: name 'pirnt' is not defined

From this code:
pirnt("Hello")

What's wrong?
```

[Screenshot: Error message in terminal and AI assistant explaining the typo]

## Advanced AI Features

### Code Review

Ask the AI to review your code:

```
Can you review this code and suggest improvements?

[paste your code here]
```

The AI will point out:
- Potential bugs
- Style improvements
- Performance issues
- Best practices

### Debugging Help

For complex problems:

1. **Describe what should happen**
2. **Show what actually happens**
3. **Include relevant code**
4. **Ask for debugging steps**

Example:
```
Expected: My program should print numbers 1 to 10
Actual: It only prints 1
Code:
for i in range(1):
    print(i)

How do I fix this?
```

### Learning Concepts

Use the AI as a tutor:

- "Teach me about loops in Python"
- "What's the difference between a list and a dictionary?"
- "Explain object-oriented programming simply"

The AI will provide explanations with examples.

### Step-by-Step Guidance

For complex tasks, ask for steps:

```
I want to create a simple calculator in Python.
Can you guide me step by step?
```

The AI will break it into manageable pieces.

## Conversation Tips

### Building on Responses

You can have back-and-forth conversations:

**You:** "How do I create a function in Python?"

**AI:** [Explains functions with example]

**You:** "Can you show one that takes two parameters?"

**AI:** [Provides updated example]

**You:** "What if I want to return multiple values?"

**AI:** [Explains returning tuples]

### Context Awareness

The AI remembers your conversation:
- References earlier messages
- Understands "it" and "that" in follow-ups
- Builds on previous explanations

### Starting Fresh

If the conversation gets confused:
- Click "New Chat" to start over
- Be more specific in your next question

[Screenshot: New chat button location]

## Working with Code Snippets

### Copying AI Suggestions

When the AI provides code:

1. **Read and understand it first**
2. **Click the copy button** on the code block
3. **Paste into your editor**
4. **Test it to make sure it works**

[Screenshot: Code block with copy button highlighted]

💡 **Tip**: Don't just copy without understanding. Ask the AI to explain any parts you're unsure about.

### Testing AI Code

Always test code suggestions:

1. Create a new test file
2. Paste the code
3. Run it
4. Verify it works as expected

If it doesn't work, tell the AI what happened.

## Best Practices

### Do's

✅ Be specific with your questions
✅ Include error messages exactly as shown
✅ Provide context about what you're trying to do
✅ Ask for explanations when you don't understand
✅ Test AI suggestions before using them
✅ Break complex problems into smaller questions

### Don'ts

❌ Ask the AI to do your homework without learning
❌ Copy code you don't understand
❌ Share sensitive information (passwords, personal data)
❌ Expect the AI to be perfect (always verify)
❌ Give up if the first answer isn't perfect (ask follow-ups)

## Common Use Cases

### Learning to Code

**Use the AI to:**
- Understand syntax and concepts
- See examples of different programming patterns
- Practice by asking for exercises
- Get explanations in simple terms

Example:
```
I'm new to Python. Can you give me a simple exercise
to practice if statements?
```

### Debugging

**Use the AI to:**
- Understand error messages
- Find logic errors in your code
- Get suggestions for fixes
- Learn debugging techniques

### Code Improvement

**Use the AI to:**
- Make code more efficient
- Follow best practices
- Improve readability
- Add error handling

Example:
```
This code works but looks messy. Can you suggest improvements?

x = input("Enter number: ")
if x == "1":
    print("one")
if x == "2":
    print("two")
if x == "3":
    print("three")
```

### Project Guidance

**Use the AI to:**
- Plan project structure
- Choose appropriate tools
- Break down complex features
- Learn project organization

Example:
```
I want to build a simple to-do list app in Python.
What files should I create and how should I organize it?
```

## Understanding AI Limitations

### What the AI Can't Do

The AI is helpful but has limits:

❌ Can't access external websites or databases
❌ Can't run code directly (use the terminal for that)
❌ Can't see your screen or files (you must share code with it)
❌ Doesn't know about your specific project unless you tell it
❌ May occasionally provide incorrect information

### Verifying Information

Always verify important information:

1. **Test the code** - Does it actually work?
2. **Check documentation** - For complex features
3. **Ask for sources** - "Where can I learn more about this?"
4. **Use common sense** - Does the answer make sense?

💡 **Tip**: The AI is a tool to help you learn and work faster, not a replacement for understanding.

## FAQ

### Is the AI always right?
No. The AI is very helpful but can make mistakes. Always test code suggestions and verify important information.

### Can the AI see my files?
No. You need to copy and paste code into the chat for the AI to see it.

### Does the AI remember previous conversations?
The AI remembers the current chat session. Starting a new chat clears the conversation history.

### Can the AI access the internet?
No. The AI works with knowledge it was trained on and the information you provide in the chat.

### What programming languages does the AI know?
The AI can help with most popular programming languages: Python, JavaScript, Java, C++, HTML/CSS, and many more.

### Can I use the AI for learning?
Yes! The AI is excellent for learning. Ask it to explain concepts, provide examples, and give you practice exercises.

### What if the AI doesn't understand my question?
Try rephrasing your question with more details, or break it into smaller parts.

### Can the AI write entire programs for me?
The AI can generate code, but you should use it as a learning tool. Understanding the code is more important than just having working code.

### Is there a limit to how many questions I can ask?
Check your account settings. Most users can ask many questions, but there may be rate limits.

### How do I report incorrect or inappropriate AI responses?
Use the feedback button (usually thumbs up/down icons) or contact support if you encounter issues.

## Privacy and Security

### What to Share

✅ **Safe to share:**
- Code snippets for learning
- Error messages
- General programming questions
- Public algorithms and patterns

❌ **Don't share:**
- Passwords or API keys
- Personal information
- Proprietary company code (unless permitted)
- Sensitive data

💡 **Tip**: Replace sensitive information with placeholder text like "YOUR_API_KEY_HERE" when asking questions.

---

**Next Steps:**
- [Learn Terminal Commands](terminal.md)
- [Manage Your Files](file-management.md)
- [Troubleshooting Guide](troubleshooting.md)
