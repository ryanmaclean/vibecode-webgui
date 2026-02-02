# Scope of Work: PR Merge & Validation Campaign

## 1. Objective
Validate and merge the backlog of feature and fix branches, ensuring strict quality control and adherence to "Definition of Done".

## 2. The PR Checklist (Definition of Done)
For a PR to be marked **DONE** and Merged, it must pass:

### 🔴 Required (Must-Have)
| ID | Requirement | Validation Method |
|----|-------------|-------------------|
| **CHK-01** | **Type Safety** | `npm run type-check` returns 0 errors. |
| **CHK-02** | **Linting** | `npm run lint` returns 0 warnings/errors. |
| **CHK-03** | **Script Parity** | New Python scripts match old Shell script functionality. |
| **CHK-04** | **Tests Included** | New Python code includes `pytest` / `unittest` coverage. |
| **CHK-05** | **Build Integrity** | `npm run build` succeeds (Next.js). |
| **CHK-06** | **Conflict Free** | No merge conflicts with `main`. |

### 🟡 Nice-to-Have (Non-Blocking)
| ID | Requirement | Validation Method |
|----|-------------|-------------------|
| **CHK-07** | **Documentation** | Usage docs updated for new scripts. |
| **CHK-08** | **Strict Strictness** | Zero `unknown` assertions (pragmatic allowance). |

## 3. Scope of Assignments
- **Agents 2-4**: TypeScript/Frontend PRs
- **Agents 5-6**: Python/Backend PRs
- **Agents 7-8**: Infrastructure/Build
- **Agents 9-10**: Audit & Merge

## 4. Exclusion Criteria
- PRs that fail **CHK-01** or **CHK-05** will be rejected/requested changes.
- "Work in Progress" (WIP) commits are out of scope.
