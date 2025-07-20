# Contributing to VibeCode

First off, thank you for considering contributing to VibeCode! It's people like you that make VibeCode such a great tool. This document provides a set of guidelines for contributing to the project.

## Code of Conduct

This project and everyone participating in it is governed by the [VibeCode Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior.

## How Can I Contribute?

### Reporting Bugs

This section explains how to submit a bug report for VibeCode. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

### Suggesting Enhancements

This section explains how to submit an enhancement suggestion for VibeCode, including completely new features and minor improvements to existing functionality.

### Your First Code Contribution

Unsure where to begin contributing to VibeCode? You can start by looking through these `good first issue` and `help wanted` issues:

- [Good first issues](https://github.com/ryanmaclean/vibecode-webgui/labels/good%20first%20issue) - issues which should only require a few lines of code, and a test or two.
- [Help wanted issues](https://github.com/ryanmaclean/vibecode-webgui/labels/help%20wanted) - issues which should be a bit more involved than `good first issue` issues.

## Development Setup

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- `pnpm` package manager

### Installation

1.  Fork the repository.
2.  Clone your fork: `git clone https://github.com/<your-username>/vibecode-webgui.git`
3.  Install dependencies: `pnpm install`
4.  Set up your local environment variables by copying `.env.example` to `.env.local` and filling in the required values.
5.  Run the development server: `pnpm dev`

## Pull Request Process

1.  Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2.  Update the README.md with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations and container parameters.
3.  Increase the version numbers in any examples and the README.md to the new version that this Pull Request would represent. The versioning scheme we use is [SemVer](http://semver.org/).
4.  You may merge the Pull Request in once you have the sign-off of two other developers, or if you do not have permission to do that, you may request the second reviewer to merge it for you.
