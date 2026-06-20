# Git Commit and Branch Naming Conventions

This document outlines the rules that are being applied to commit and branch naming in our codebase.

## Commit Messages

1. **Start with a capital letter**: Every commit message should start with a capital letter.

   **Wrong**: `added new login feature`

   **Right**: `Added new login feature`

2. **Contain a summary line**: The first line of the commit message should be a summary of the changes.

   **Right**: `Added new login feature`

   `In this change, a new login feature was added to the application...`

3. **Be within a reasonable character limit**: Each line of the commit message should not exceed 72 characters.

4. **No leading, trailing or consecutive spaces**: Commit messages should not have unnecessary leading, trailing or consecutive spaces.

   **Wrong**: ` Added new login feature` or `Added new login feature `

   **Right**: `Added new login feature`

## Branch Names

1. **Start with a valid prefix**: Branch names should start with one of these valid prefixes:

   - `feat/`
   - `bugfix/`
   - `hotfix/`
   - `refactor/`
   - `docs/`
   - `test/`
   - `chore/`

   **Wrong**: `new-login-feature`

   **Right**: `feature/new-login`

2. **Contain only lowercase letters, numbers, and hyphens**: Branch names should only contain lowercase letters, numbers, and hyphens (no spaces, uppercase letters, or special characters).

   **Wrong**: `feat/newLoginFeature`

   **Right**: `feat/new-login-feature`

3. **Be under 50 characters**: Overall, branch names should be under 50 characters long.
