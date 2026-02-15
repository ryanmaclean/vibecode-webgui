// Cache for CLI availability checks to avoid repeated calls
let ghCliAvailable: boolean | null = null
let glabCliAvailable: boolean | null = null

/**
 * Check if the GitHub CLI (gh) is available and working.
 * Results are cached to avoid repeated CLI calls.
 * @returns Promise<boolean> - true if gh CLI is available
 */
export async function isGitHubCLIAvailable(): Promise<boolean> {
  if (ghCliAvailable !== null) {
    return ghCliAvailable
  }

  try {
    const result = await Bun.$`gh --version`.quiet()
    ghCliAvailable = result.exitCode === 0
  } catch {
    ghCliAvailable = false
  }

  return ghCliAvailable
}

/**
 * Check if the GitLab CLI (glab) is available and working.
 * Results are cached to avoid repeated CLI calls.
 * @returns Promise<boolean> - true if glab CLI is available
 */
export async function isGitLabCLIAvailable(): Promise<boolean> {
  if (glabCliAvailable !== null) {
    return glabCliAvailable
  }

  try {
    const result = await Bun.$`glab --version`.quiet()
    glabCliAvailable = result.exitCode === 0
  } catch {
    glabCliAvailable = false
  }

  return glabCliAvailable
}

/**
 * Clear the cached CLI availability results.
 * Useful for testing or when CLI installation status may have changed.
 */
export function clearCliCache(): void {
  ghCliAvailable = null
  glabCliAvailable = null
}
