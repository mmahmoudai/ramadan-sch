# Branch Protection for `develop`

To make CI required before merges to `develop`, enable branch protection in GitHub settings:

1. Go to `Settings` -> `Branches`.
2. Add or edit a branch protection rule for `develop`.
3. Enable `Require a pull request before merging`.
4. Enable `Require status checks to pass before merging`.
5. Select the required check: `ci` (from `.github/workflows/ci.yml`).
6. Enable `Require branches to be up to date before merging`.

This repository now provides the `ci` workflow and smoke E2E checks that can be enforced by that rule.
