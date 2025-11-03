---
name: Documentation Tone Cleanup
about: Track cleanup of excessive emoji and sales language in documentation
title: 'Reduce emoji and improve documentation authenticity'
labels: documentation, good first issue
assignees: ''
---

## Problem

Repository documentation has too many emoji and overly enthusiastic language that doesn't match an authentic open source project tone.

### Current State (Scan Results)

**In our user-facing documentation**:
- ~6,954 emoji (mostly checkmarks ✅ and warnings ⚠️)
- ~303 checkmarks specifically in release docs
- Heavy use in BUILD.md, USAGE.md, RELEASE_NOTES.md

**Most is informational** (checklists, status indicators) but could be toned down.

## What Good Looks Like

See `docs/STYLE_GUIDE.md` for the authentic tone we're aiming for.

**Principles**:
- Honest about what works and what doesn't
- Helpful without being pushy
- Minimal emoji (only when adding meaning)
- No celebration emoji (🎉 🚀 ✨)
- Checkmarks for actual status, not hype

## Files to Review

Priority files to clean up:
- [ ] `docs/releases/v0.9-beta/BUILD.md` - Heavy checkmark usage
- [ ] `docs/releases/v0.9-beta/USAGE.md` - Heavy checkmark usage  
- [ ] `docs/releases/v0.9-beta/RELEASE_NOTES.md` - Needs review
- [ ] Any remaining docs/guides/ with excessive emoji

## Acceptance Criteria

- [ ] Checkmarks used only for actual pass/fail status
- [ ] No celebration emoji
- [ ] Exclamation points only for real warnings/emphasis
- [ ] Language is helpful, not sales-y
- [ ] Tone matches STYLE_GUIDE.md

## Notes

- Release template and CONTRIBUTING.md already fixed (authentic versions)
- STYLE_GUIDE.md created to guide future writing
- HONEST_ASSESSMENT.md has the right tone
- Don't need to remove ALL emoji, just make them meaningful
- Historical docs in archive/ can stay as-is

## Help Wanted

This is a good first issue if you want to contribute. No coding required, just help make the docs more authentic and less corporate.

