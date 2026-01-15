# VibeCode Security Action Checklist
## VS Code Fork Supply Chain Vulnerability Response

**Date Created:** January 14, 2026
**Priority:** CRITICAL
**Owner:** [ASSIGN OWNER]
**Target Completion:** [SET DATE - RECOMMEND: Within 7 days]

---

## Verification Complete

✅ **Vulnerability confirmed:** GitHub.copilot extension does not exist on Open VSX
✅ **Script executed:** `./scripts/verify-extension-availability.sh` - 1 critical issue found
✅ **Analysis complete:** Full 48-page security assessment created
✅ **All other extensions verified:** 22/23 extensions exist on Open VSX

---

## Priority 1: Emergency Response (Week 1)

### Day 1: Immediate Mitigation

- [ ] **Remove GitHub.copilot from product.json.template**
  - File: `/Users/ryan.maclean/vibecode-webgui/docs/product.json.template`
  - Lines to remove:
    - Line 178-184: `"GitHub.copilot": { ... }` from `extensionRecommendations`
    - Line 198: `"GitHub.copilot.manageExtension"` from `commonlyUsedSettings`
  - **Verification:** Run `./scripts/verify-extension-availability.sh` - should pass

- [ ] **Update VM product.json**
  - File: `/Users/ryan.maclean/vibecode-webgui/azure/initramfs-rebuild/rootfs/opt/openvscode/product.json`
  - Apply same changes
  - Verify with grep: `grep -i "copilot" <file>` should return nothing

- [ ] **Rebuild initramfs with fix**
  ```bash
  cd azure/initramfs-rebuild
  # Follow your standard initramfs rebuild process
  # Ensure new product.json is included
  ```

- [ ] **Test in development VM**
  - Boot VM with new initramfs
  - Open .py, .ts, .go files
  - Confirm NO Copilot recommendation appears
  - Document test results

### Day 2: Additional Hardening

- [ ] **Disable extension auto-update**
  - File: `azure/initramfs-rebuild/rootfs/tmp/vscode-data/Machine/settings.json`
  - Add:
    ```json
    {
      "extensions.autoUpdate": false,
      "extensions.autoCheckUpdates": false
    }
    ```

- [ ] **Pin Datadog extension version in init script**
  - File: `azure/initramfs-rebuild/rootfs/init`
  - Lines 444-453: Add version verification (see full analysis Section 4.1.3)
  - Make extension directory read-only after setup

- [ ] **Create extension allowlist**
  - File: `config/extension-allowlist.json` (create new)
  - Content: See full analysis Section 4.2.1
  - Include only verified extensions

### Day 3-4: CI/CD Integration

- [ ] **Add verification to CI/CD**
  - Create: `.github/workflows/extension-security-scan.yml`
  - Add step: `./scripts/verify-extension-availability.sh`
  - Block merges if verification fails

- [ ] **Add pre-commit hook** (optional but recommended)
  ```bash
  #!/bin/bash
  # .git/hooks/pre-commit

  if git diff --cached --name-only | grep -q "product.json.template"; then
      echo "Verifying extension security..."
      ./scripts/verify-extension-availability.sh || exit 1
  fi
  ```

- [ ] **Document changes**
  - Update CHANGELOG
  - Add security advisory
  - Document for users

### Day 5: Testing & Validation

- [ ] **Full security test**
  - [ ] GitHub.copilot not recommended ✅
  - [ ] Datadog extension still works ✅
  - [ ] Other extensions still recommended ✅
  - [ ] Auto-update disabled ✅
  - [ ] CI/CD verification works ✅

- [ ] **Performance test**
  - VM boot time unchanged
  - Extension loading time acceptable
  - No regressions

### Day 6-7: Deployment

- [ ] **Deploy to staging**
  - Test with real users
  - Monitor for issues
  - Verify security measures active

- [ ] **Deploy to production**
  - Update DMG/installer
  - Push to distribution
  - Monitor rollout

- [ ] **User communication**
  - Release notes mention security fix
  - Update documentation
  - Optional: Security advisory if users might have been exposed

---

## Priority 2: Enhanced Security (Weeks 2-4)

### Week 2: Verification & Validation

- [ ] **Implement SHA256 verification**
  - Script: `scripts/verify-extension-signature.sh`
  - See full analysis Section 4.2.3

- [ ] **Add extension scanning**
  - Script: `scripts/scan-extension-security.sh`
  - See full analysis Section 4.2.4

- [ ] **Test all verification scripts**
  - Test with known good extensions
  - Test with mock malicious extensions
  - Verify alerts work

### Week 3: User Protection

- [ ] **Design security warning UI**
  - Add to Swift app: `ExtensionSecurityWarning.swift`
  - See full analysis Section 4.2.2

- [ ] **Implement allowlist enforcement**
  - Load `config/extension-allowlist.json`
  - Block non-allowlisted extensions
  - Add override mechanism for advanced users

- [ ] **Create user documentation**
  - Extension security best practices
  - How to verify extensions
  - What to do if compromised

### Week 4: Testing & Deployment

- [ ] **Security audit**
  - Review all changes
  - Penetration test if possible
  - Document security posture

- [ ] **Deploy enhanced security**
  - Staged rollout
  - Monitor for issues
  - User feedback

---

## Priority 3: Advanced Protection (Months 2-3)

### Month 2: Infrastructure

- [ ] **Evaluate private registry**
  - Cost/benefit analysis
  - Technical feasibility
  - Maintenance requirements

- [ ] **Set up test registry** (if proceeding)
  - Deploy Open VSX instance
  - Migrate Datadog extension
  - Test integration

- [ ] **Implement if beneficial**
  - Full deployment
  - Update product.json
  - User documentation

### Month 3: Monitoring & Sandboxing

- [ ] **Runtime behavior monitoring**
  - Extension network monitoring
  - File access monitoring
  - Process execution monitoring

- [ ] **Research sandboxing**
  - VS Code extension host capabilities
  - macOS App Sandbox integration
  - Container-based isolation

- [ ] **Create security dashboard**
  - Datadog integration
  - Alert configuration
  - Incident response procedures

---

## Success Criteria

### Week 1 (Emergency Response)
- ✅ GitHub.copilot recommendation removed
- ✅ Verification script passes
- ✅ VM rebuilt and tested
- ✅ Deployed to production
- ✅ Zero critical vulnerabilities

### Month 1 (Enhanced Security)
- ✅ Extension verification automated (CI/CD)
- ✅ SHA256 verification implemented
- ✅ Security warnings in UI
- ✅ User documentation complete
- ✅ Allowlist enforced

### Month 3 (Advanced Protection)
- ✅ Private registry evaluated (decision made)
- ✅ Runtime monitoring active
- ✅ Security dashboard operational
- ✅ Incident response procedures documented
- ✅ Zero security incidents

---

## Risk Assessment

### Before Mitigation
- **Risk Level:** CRITICAL
- **Exploitability:** TRIVIAL (< 5 minutes)
- **Impact:** SEVERE (code execution in dev environment)
- **Likelihood:** HIGH (actively exploited in other IDEs)

### After Priority 1
- **Risk Level:** LOW
- **Exploitability:** DIFFICULT (requires bypassing verification)
- **Impact:** MODERATE (other attack vectors may exist)
- **Likelihood:** LOW (proactive security measures)

### After Priority 2
- **Risk Level:** VERY LOW
- **Exploitability:** VERY DIFFICULT (multiple layers of protection)
- **Impact:** MINIMAL (monitoring catches compromises quickly)
- **Likelihood:** VERY LOW (comprehensive security)

---

## Resources Required

### Personnel
- **Week 1:** 1 developer, 40 hours (full-time)
- **Weeks 2-4:** 1 developer, 120 hours (full-time)
- **Months 2-3:** 1 developer, 240 hours (part-time, 20h/week)

### Infrastructure
- **CI/CD:** Existing GitHub Actions (no additional cost)
- **Testing:** Existing infrastructure
- **Private Registry:** $50-200/month (optional, Phase 3)
- **Monitoring:** Existing Datadog subscription

### Tools
- ✅ Extension verification: `curl`, `jq` (already installed)
- ✅ SHA256 verification: `shasum` (built-in macOS)
- ✅ Static analysis: Open source tools (semgrep, bandit)
- ✅ CI/CD: GitHub Actions (existing)

---

## Communication Plan

### Internal
- [ ] Brief engineering team on vulnerability
- [ ] Share this checklist and full analysis
- [ ] Assign owner and set timeline
- [ ] Daily standups during Week 1
- [ ] Weekly updates during Weeks 2-4

### External
- [ ] Release notes mention "security improvements"
- [ ] Optional: Security advisory if users exposed
- [ ] Update documentation
- [ ] Consider blog post about security approach

### Security Community
- [ ] Thank researchers who disclosed issue
- [ ] Share learnings (optional)
- [ ] Contribute fixes to OpenVSCode Server upstream (optional)

---

## Rollback Plan

If issues arise after deployment:

1. **Immediate:** Rollback to previous version
2. **Investigation:** Identify what went wrong
3. **Fix:** Address issue in development
4. **Retest:** Comprehensive testing
5. **Redeploy:** When fix verified

**Rollback triggers:**
- VM fails to boot
- Datadog extension stops working
- User reports of broken functionality
- Performance degradation > 20%

---

## Documentation

### Created Files
- ✅ `VSCODE_FORK_SUPPLY_CHAIN_ANALYSIS.md` - Full 48-page analysis
- ✅ `SECURITY_FINDINGS_SUMMARY.md` - Executive summary
- ✅ `SECURITY_ACTION_CHECKLIST.md` - This file
- ✅ `scripts/verify-extension-availability.sh` - Verification tool

### To Create
- [ ] `config/extension-allowlist.json` - Extension allowlist
- [ ] `scripts/verify-extension-signature.sh` - Signature verification
- [ ] `scripts/scan-extension-security.sh` - Security scanner
- [ ] `.github/workflows/extension-security-scan.yml` - CI/CD integration
- [ ] User security documentation

### To Update
- [ ] `docs/product.json.template` - Remove GitHub.copilot
- [ ] `azure/initramfs-rebuild/rootfs/opt/openvscode/product.json` - Remove GitHub.copilot
- [ ] `azure/initramfs-rebuild/rootfs/init` - Add version verification
- [ ] `CHANGELOG.md` - Document security fix
- [ ] User-facing documentation

---

## Questions & Answers

**Q: Is this really critical?**
A: Yes. Over 1,000 developers installed placeholder extensions in other IDEs despite warnings. Attack is trivial to execute.

**Q: Can we just disable all recommendations?**
A: Not recommended. Recommendations improve UX. Better to verify and secure them.

**Q: What about users who already have VibeCode?**
A: They're at risk if they open certain file types. Priority 1 deployment prevents new exposures. Existing users protected once they update.

**Q: How long will this take?**
A: Priority 1 (critical fix): 1 week. Full security hardening: 1 month. Advanced protection: 3 months.

**Q: Do we need Priority 2 and 3?**
A: Priority 1 eliminates critical vulnerability. Priority 2 adds defense-in-depth. Priority 3 is long-term security posture. Recommend at least Priority 1-2.

**Q: Can we tell users about this?**
A: After Priority 1 deployed. Can include in release notes. Full disclosure optional but builds trust.

---

## Next Steps

1. **Assign owner** to this checklist
2. **Set target date** for Priority 1 completion
3. **Brief team** on vulnerability and plan
4. **Start work** on Day 1 tasks
5. **Daily check-ins** during Week 1

---

## Sign-off

### Implementation Team
- [ ] **Owner:** _________________ Date: _______
- [ ] **Security Review:** _________________ Date: _______
- [ ] **QA Approval:** _________________ Date: _______

### Deployment Approval
- [ ] **Staging:** _________________ Date: _______
- [ ] **Production:** _________________ Date: _______

---

## Status Tracking

| Priority | Status | Start Date | Complete Date | Notes |
|----------|--------|------------|---------------|-------|
| Priority 1: Day 1 | ⏳ Not Started | | | |
| Priority 1: Day 2 | ⏳ Not Started | | | |
| Priority 1: Day 3-4 | ⏳ Not Started | | | |
| Priority 1: Day 5 | ⏳ Not Started | | | |
| Priority 1: Day 6-7 | ⏳ Not Started | | | |
| Priority 2: Week 2 | ⏳ Not Started | | | |
| Priority 2: Week 3 | ⏳ Not Started | | | |
| Priority 2: Week 4 | ⏳ Not Started | | | |
| Priority 3: Month 2 | ⏳ Not Started | | | |
| Priority 3: Month 3 | ⏳ Not Started | | | |

Legend: ⏳ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked

---

**END OF CHECKLIST**

For questions or clarifications, refer to:
- Full analysis: `VSCODE_FORK_SUPPLY_CHAIN_ANALYSIS.md`
- Executive summary: `SECURITY_FINDINGS_SUMMARY.md`
