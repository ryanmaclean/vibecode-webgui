# Contributing to VibeCode

Thanks for considering contributing. This project is in early stages and could use help.

## Current State

Honestly: The infrastructure is solid but only 2 of 6 VMs work, and no services are installed yet. There's real work to do if you're interested.

## Where Help Is Needed

### High Priority

1. **Fix bootloader issues** - 4 VMs won't boot
   - Problem: EFI configuration for fresh Alpine images
   - Impact: Blocks most functionality
   - Skills: Familiarity with UEFI, VZ framework
   
2. **Service installation** - VMs have no applications
   - Problem: Need PostgreSQL, Valkey, Node.js, code-server in VMs
   - Impact: Users can't actually use the VMs
   - Skills: Linux system administration, cloud-init

3. **Testing actual services** - No validation yet
   - Problem: Haven't tested if services work when installed
   - Impact: Don't know if the whole thing works end-to-end
   - Skills: QA, integration testing

### Medium Priority

4. Auto-start mechanism debugging
5. SSH configuration
6. Performance benchmarking
7. Datadog metrics validation

### Nice to Have

8. Tauri integration
9. Additional VMs
10. macOS Tahoe ASIF format testing

## How to Contribute

### Before You Start

1. Read VMS_WORKING_STATUS.md to understand current state
2. Check existing issues (if any)
3. Maybe open an issue to discuss your approach
4. No pressure - contribute what you can when you can

### Development Setup

```bash
git clone https://github.com/ryanmaclean/vibecode-webgui.git
cd vibecode-webgui

# Build the app
cd VibeCodeSwift
swift build -c debug

# Run tests
cd ..
./scripts/staff-level-test-suite.sh
```

### Making Changes

1. **Branch naming**: `fix/bootloader-issue` or `feature/ssh-config`
2. **Commits**: Be descriptive but don't overthink it
3. **Tests**: Add tests if you can, but we understand if you can't
4. **Documentation**: Update if relevant

### Pull Request Process

1. **Fork and branch** - Standard GitHub workflow
2. **Make your changes** - Do what makes sense
3. **Test locally** - Run `./scripts/staff-level-test-suite.sh`
4. **Open PR** - Describe what you did and why
5. **Be patient** - Reviews take time

No strict requirements. We'd rather have imperfect contributions than no contributions.

## Code Style

### Swift

Follow standard Swift conventions:
- 4 spaces for indentation
- Clear variable names
- Comments where logic is complex

Don't stress about perfection - working code is better than perfect code.

### Shell Scripts

- Use `#!/bin/bash`
- Comment non-obvious parts
- Handle errors (`set -e` is good)

### Documentation

- Markdown files
- Plain language (avoid jargon when possible)
- Be honest about limitations

## Testing

### Run the test suite

```bash
./scripts/staff-level-test-suite.sh
```

Currently 27 of 33 tests pass. If your change doesn't break existing tests and ideally adds new ones, that's great.

### Manual testing

Since services aren't installed:
- Test that VMs still discover correctly
- Test that working VMs (Pgvector, Ide) still boot
- Test that you didn't break the build

## Communication

### Be Nice

- Assume good intentions
- Be patient with each other
- It's okay to disagree
- Be constructive

### Be Honest

- If something doesn't work, say so
- If you're not sure, admit it
- If you need help, ask

### No Pressure

- Contribute when you have time
- No deadlines unless you set them
- It's fine to abandon work if life gets busy
- We appreciate any effort

## Review Process

### What We Look For

1. **Does it work?** - Most important
2. **Does it break anything?** - Run tests
3. **Is it documented?** - At least basics
4. **Is the code reasonable?** - Doesn't have to be perfect

### What We Don't Require

- Perfect test coverage
- Extensive documentation (basics are fine)
- Adherence to every style guide rule
- Immediate responses to review comments

### Review Timeline

We'll try to review within a week, but no promises. Life happens.

## Getting Help

### If You're Stuck

- Check docs/guides/ for technical docs
- Look at existing code for examples
- Open an issue to ask questions
- No question is too basic

### If You're Not Sure

That's fine. Open a draft PR and ask for feedback.

## Recognition

Contributors will be:
- Listed in release notes (if they want)
- Credited in README (if they want)
- Appreciated genuinely

No fake "rockstar contributor" badges or corporate thank-yous. Just real appreciation for real help.

## Non-Goals

We're NOT trying to:
- Build the perfect VM manager
- Compete with commercial products
- Win awards or get press
- Grow a huge community

We ARE trying to:
- Make a useful tool
- Learn about macOS virtualization
- Help developers who need local VMs
- Share knowledge

## License

MIT License - Use it however you want. We just ask that you share improvements back if they might help others.

## Questions?

Open an issue. We'll do our best to help, but we're not running a support desk. Community help is appreciated.

---

**Thanks for reading this far.** If you contribute anything, even a small fix or documentation improvement, we appreciate it. And if you just use the tool or learn from the code, that's valuable too.

No pressure. Just build cool stuff.

