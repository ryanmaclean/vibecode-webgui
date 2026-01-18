# VibeCode Documentation Style Guide

How we write docs in this project.

## Tone

### Be Honest

Don't say things work if they don't.

Bad: "All features working perfectly!"  
Good: "2 of 6 VMs work. The others need bootloader fixes."

### Be Helpful Without Pressure

Offer help, don't demand action.

Bad: "You MUST run these tests before committing!"  
Good: "Running ./scripts/test-suite.sh before committing might catch issues."

### Be Humble

We're building software, not curing diseases.

Bad: "Revolutionary breakthrough in VM technology!"  
Good: "Uses the same approach as Podman, but with native Swift."

Bad: "World-class engineering!"  
Good: "The code is reasonably clean and mostly works."

### Admit What You Don't Know

It's okay to not have all the answers.

Good: "We're not sure if this will work on Intel Macs. Please test and let us know."  
Good: "This approach might not scale to 10+ VMs. We haven't tested it yet."  
Good: "We're still figuring out the best way to handle X."

## Emoji Usage

### Use Sparingly

Emoji should add meaning, not excitement.

**Acceptable**:
- ⚠️ for warnings
- ❌ for actual problems  
- Maybe ✅ for confirmed working features

**Avoid**:
- 🎉 celebration emoji (feels forced)
- 🚀 rocket ships (we're not launching spacecraft)
- ✨ sparkles (this isn't magic)
- 💯 100 (usually not true anyway)

### If in doubt, skip it

Periods work fine.

## Exclamation Points

### Use Rarely

Bad: "This feature is amazing! It works perfectly! You'll love it!"  
Good: "This feature works on macOS 15 and later."

**When to use**:
- Actual critical warnings: "Warning! This will delete all VMs."
- Genuine excitement is okay occasionally
- Real emergencies

**Default**: Use periods. They're underrated.

## Language to Avoid

### Marketing Speak

❌ "Best-in-class"  
❌ "Revolutionary"  
❌ "Game-changing"  
❌ "Amazing"  
❌ "Perfect"  
❌ "Incredible"  
❌ "Awesome" (unless something is literally awe-inspiring)

### Corporate Jargon

❌ "Mission critical"  
❌ "Mission accomplished"  
❌ "Best practices" (sometimes necessary, but often meaningless)  
❌ "Leverage"  
❌ "Synergy"  
❌ "Deliverables" (just say "what we built")

### Pressure Language

❌ "Must do X immediately"  
❌ "Critical that you Y"  
❌ "Required for production"  

Use: "Consider X" or "X would help" or "We need Y"

## Language to Use

### Plain English

- "This works"
- "This doesn't work yet"
- "We're working on it"
- "Help wanted"
- "Thanks for contributing"

### Technical Accuracy

Be specific:
- "27 of 33 tests pass" (not "most tests pass")
- "2 of 6 VMs boot" (not "VMs are working")
- "Infrastructure complete, services pending" (not "almost done")

### Acknowledge Difficulty

Good: "Getting UEFI boot working was tricky. Here's what we learned."  
Good: "We tried three different approaches before this one worked."  
Good: "This is still rough. Sorry about that."

## Structure

### Documentation Hierarchy

```
README.md - What is this? Why would I use it? Current honest state.
CHANGELOG.md - What changed, when
CONTRIBUTING.md - How to help (no pressure)
docs/guides/ - How to do specific things
docs/architecture/ - Why we made certain decisions
docs/releases/ - What's in each release (honest assessment)
```

### Page Structure

1. **Start with current state** - What works right now
2. **Be clear about limitations** - What doesn't work
3. **Provide context** - Why we made certain choices
4. **Offer help** - How to get started, no pressure
5. **Admit unknowns** - What we're still figuring out

## Code Examples

### Show Real Code

Use actual code from the project, not idealized examples.

### Admit When Examples Are Untested

If you haven't run the code:
"(Note: This example is untested - please verify it works)"

### Show Failures Too

Good practice: Show what didn't work and why.

## README Files

### Start with Honesty

Bad: "Welcome to the amazing VibeCode project!"  
Good: "VibeCode is a macOS VM manager. It's early beta - 2 of 6 VMs work."

### Set Expectations

Tell people:
- What actually works right now
- What doesn't work
- When/if you plan to fix it (or if you don't know)

### Don't Oversell

If it's a simple wrapper around Apple's framework, say that.
If you copied the approach from Podman, credit them.
If you're not sure it's useful, admit it.

## Error Messages

### Be Helpful

Bad: "Error 0x3492"  
Good: "Can't start VM - bootloader configuration is invalid. See troubleshooting guide."

### Don't Blame Users

Bad: "You didn't configure X correctly"  
Good: "X needs to be configured. Here's how."

## Warnings

### Be Direct

When something might break, say so clearly:

"Warning: This will delete all VM images. There's no undo."

Not: "Please note that this operation may result in data loss."

## Credits

### Give Credit Where Due

- If you used someone's code, credit them
- If an approach is from another project, mention it
- If someone helped, thank them

### Don't Take Credit for Others' Work

Bad: "We invented this amazing new approach"  
Good: "This uses the same approach as Podman, implemented in Swift"

## Updates and Changes

### Be Honest About Delays

If something isn't ready: "Not done yet. Working on it."  
Not: "Coming soon!" (if you don't know when)

### Admit Mistakes

If you broke something: "Sorry, we broke X in the last release. Fix is in progress."  
Not: Silence or defensive explanations

## Tone Examples

### Writing About Features

❌ Bad: "Our revolutionary AI-powered VM management system delivers unprecedented performance!"

✅ Good: "Native macOS app for managing VMs using Apple's Virtualization framework. Currently 2 of 6 VMs work."

### Writing About Problems

❌ Bad: "Minor configuration issue that doesn't impact core functionality"

✅ Good: "4 VMs won't boot due to bootloader problems. This is a significant issue we're working on."

### Writing About Status

❌ Bad: "Project is 95% complete and ready for production!"

✅ Good: "Infrastructure works well. Services aren't installed yet. Beta quality."

### Writing About Contributions

❌ Bad: "We need world-class engineers to deliver excellence!"

✅ Good: "Help wanted fixing bootloader issues. No experience with UEFI required - we can help you learn."

## What Good Looks Like

### Good README (Honest)

```markdown
# Project Name

Brief description of what it is.

## Current State

Works: X, Y
Doesn't work: Z (we're working on it)
Untested: A, B

## Installation

Steps here.

## Known Issues

The main problems we know about.
```

### Good Release Notes (Realistic)

```markdown
# v0.9-beta

Beta release. Some things work, some don't.

What works:
- Infrastructure
- 2 of 6 VMs

What doesn't:
- Services not installed
- 4 VMs have bootloader issues

Not ready for production use.
```

### Good Contributing Guide (Welcoming)

```markdown
# Contributing

Thanks for considering helping.

We need help with X and Y. No pressure.

If interested:
1. Read the docs
2. Pick something that interests you
3. Open an issue or PR
4. We'll help where we can
```

## The Spirit of This Guide

### Write Like a Human

- You're talking to another developer
- They're smart but might not know your project
- Be respectful of their time
- Be honest about the state of things

### Don't Waste People's Time

- Be direct
- Don't oversell
- Admit limitations upfront
- Save them from chasing dead ends

### Show Respect

- For contributors' time
- For users' intelligence (don't patronize)
- For the difficulty of the work
- For the fact that this might not work

## When in Doubt

Ask yourself:
- "Would I believe this if I read it?"
- "Am I being honest?"
- "Would this help someone or just make them feel good?"
- "Am I respecting the reader's time and intelligence?"

If any answer is "no", rewrite it.

---

**This guide might seem negative.** It's not - it's realistic. Good open source projects are honest, helpful, and humble. Users and contributors appreciate that more than hype.

