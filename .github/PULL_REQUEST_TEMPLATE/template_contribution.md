## Template Contribution

Thank you for contributing an environment template to VibeCode! This helps the community get productive faster.

**Template Name**: [e.g., react-typescript-vite, python-ml-toolkit]

**Template Category**: [e.g., react, python, go, rust, etc.]

**Template Path**: [e.g., config/templates/react/my-template]

## Description

Please provide a clear description of what this template provides:

- What technology stack does this template support?
- What use cases is this template optimized for?
- What pre-installed tools/dependencies are included?

## Template Type

Please mark the relevant option:

- [ ] New template for an existing category (e.g., another React variant)
- [ ] New template for a new category (e.g., first Elixir template)
- [ ] Enhancement/update to existing template
- [ ] Template with specialized configuration (e.g., GPU support, specific framework version)

## Template Contents

### Required Files

Please confirm your template includes all required files:

- [ ] `template.json` - Template metadata and configuration
- [ ] `README.md` - Comprehensive documentation
- [ ] `.env.example` - Environment variables template (if applicable)
- [ ] Source files/starter code appropriate for the stack

### Configuration

- [ ] Monitoring configuration included (Datadog/Prometheus)
- [ ] Resource requirements specified in template.json
  - Memory allocation
  - Storage requirements
  - Network requirements
- [ ] Dependencies clearly documented
- [ ] Build/development scripts included

### Documentation Quality

Your template's README.md includes:

- [ ] Clear overview of what the template provides
- [ ] Prerequisites and system requirements
- [ ] Quick start guide / getting started steps
- [ ] Development workflow instructions
- [ ] Testing instructions (if applicable)
- [ ] Deployment considerations (if applicable)
- [ ] Troubleshooting common issues
- [ ] Links to relevant documentation

## Validation

### Template Validation Script

- [ ] Ran `node scripts/validate-template.js <template-path>`
- [ ] All validation checks passed
- [ ] No errors or warnings reported

**Validation Output**:
```
[Paste the output from the validation script here]
```

### Manual Testing

Please confirm you have tested:

- [ ] Template files are complete and not corrupted
- [ ] All dependencies can be installed successfully
- [ ] Sample application/code runs without errors
- [ ] Development server starts (if applicable)
- [ ] Build process completes successfully (if applicable)
- [ ] Monitoring configuration is valid
- [ ] Resource allocation is appropriate for the workload

### Testing Environment

- **OS/Architecture tested on**: [e.g., macOS 14.0 (Sonoma) - Apple Silicon M2]
- **VM Platform**: [e.g., vfkit version]
- **Test Date**: [e.g., 2026-02-14]

## Performance Characteristics

Help users understand the resource footprint:

- **Estimated boot time**: [e.g., 30 seconds]
- **Memory usage at idle**: [e.g., 2GB]
- **Recommended minimum resources**: [e.g., 4GB RAM, 10GB storage]
- **Typical development workload resources**: [e.g., 8GB RAM during builds]

## Use Cases

What problems does this template solve? Who would benefit from using it?

1. [Use case 1]
2. [Use case 2]
3. [Use case 3]

**Example projects/scenarios**:
- [e.g., "Building a React SPA with TypeScript"]
- [e.g., "Training PyTorch models locally"]

## Monitoring & Observability

- [ ] Template includes monitoring configuration
- [ ] Custom metrics defined (if applicable)
- [ ] Health check endpoints configured (if applicable)
- [ ] Logging configuration included

**Monitoring Provider**: [e.g., Datadog, Prometheus, Both, None]

**Key metrics tracked**:
- [Metric 1]
- [Metric 2]

## Breaking Changes / Dependencies

- [ ] No breaking changes to existing templates
- [ ] No new system-level dependencies required
- [ ] Compatible with current VibeCode version

**If there are dependencies or breaking changes, describe them**:
- [Details here]

## Screenshots / Examples (Optional)

If applicable, include screenshots or code examples showing:
- What the development environment looks like
- Sample application running
- Monitoring dashboards

<details>
<summary>Screenshots/Examples</summary>

[Paste screenshots or examples here]

</details>

## Checklist

Before submitting this PR, please ensure:

- [ ] I have read the template contribution guidelines
- [ ] Template follows the project structure conventions
- [ ] All required files are included and properly formatted
- [ ] Template validation script passes without errors
- [ ] I have tested the template end-to-end in a fresh environment
- [ ] Documentation is clear and comprehensive
- [ ] Monitoring configuration is included and valid
- [ ] Resource requirements are accurately specified
- [ ] No sensitive information (secrets, API keys, credentials) is included
- [ ] Template name follows naming conventions (lowercase, hyphen-separated)
- [ ] LICENSE information is included (if template includes third-party code)
- [ ] I have filled out this PR template completely

## Maintenance Commitment

- [ ] I am willing to maintain this template and address issues
- [ ] I will respond to feedback and update documentation as needed
- [ ] I understand templates may be updated by maintainers for consistency

## Additional Context

Any additional information that would help reviewers:

- Why did you create this template?
- Are there alternative approaches you considered?
- Any known limitations or caveats?
- Special considerations for certain platforms?

## Related Issues

Links to related issues or discussions:

- Addresses #(issue number)
- Related to #(issue number)
- Discussion: (link)

## For Reviewers

**Estimated Review Time**: [e.g., 15-30 minutes for basic template, 1+ hour for complex template]

**Review Focus Areas**:
- [ ] Template structure and completeness
- [ ] Documentation quality
- [ ] Resource allocation appropriateness
- [ ] Monitoring configuration validity
- [ ] Security considerations
- [ ] Naming and categorization

---

**Thank you for contributing to VibeCode! 🚀**

Your template will help developers get started faster. We appreciate your effort to improve the project and will review this as soon as possible.

**Questions?** Feel free to ask in the comments or reach out to maintainers.
