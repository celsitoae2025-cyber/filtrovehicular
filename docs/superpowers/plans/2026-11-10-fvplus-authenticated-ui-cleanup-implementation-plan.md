# FV+ authenticated UI and repository cleanup plan

## Objective

Improve the authenticated vehicle-filtering platform's visual consistency and tidy confirmed disposable or unreferenced project artifacts. Keep the login and registration experience unchanged. Make local changes only; do not push or deploy.

## Scope and constraints

- Apply the established sign-in/register visual language to authenticated app screens and admin screens, scoped to `.nv-app` and `.admin-app`.
- Preserve login and registration behavior, report/PDF layout, print styles, CITV pages, and server/business workflows. Correct only malformed field-label comparisons in the report renderer.
- Remove only QA browser profiles that are confirmed unused, unreferenced and outside any active Chrome process.
- Move QA payment screenshots and HTML into `docs/qa/pagos/` so useful evidence remains available without cluttering the repository root.
- Add ignore rules for disposable QA browser profiles.
- Remove a source or asset only when repository-wide references, dynamic loading paths, and build/deploy configuration confirm it is unused. Preserve aliases with distinct consumers and compatibility modules.
- Do not inspect or expose credentials, browser profile contents, or ignored credential files.

## Implementation steps

1. Recheck the clean Git state, exact QA paths, active Chrome process arguments, and all references to candidate CSS, JavaScript, and icon files.
2. Add scoped visual refinements to `css/sistema-visual.css` for `.nv-app` and `.admin-app` only. Keep auth selectors, report/print output and CITV styling isolated.
3. Move `.qa-pagos-*` artifacts into `docs/qa/pagos/`, preserving their filenames and contents.
4. Verify the three `.qa-chrome-*` directories are inactive, resolve each path, assert it is a direct child of this workspace, and remove only those exact directories if the environment permits; add a matching `.gitignore` entry.
5. Prune only confirmed dead CSS/JS/icon aliases; retain any file referenced dynamically, through compatibility hooks, or by deployment configuration.
6. Review the complete diff and run static reference/path checks only. Do not run test suites, browser flows, or publish changes unless separately requested.

## Verification

- Confirm `git diff --check` passes and inspect the full diff.
- Confirm login/register behavior, generated PDF layout, print styles, and CITV were not changed; separately review the report-field parsing corrections.
- Search the final repository for remaining references to every removed path and verify QA artifacts exist in their new location.
- Report that visual browser QA and production deployment were not performed.

## Rollback

- Revert the scoped stylesheet and `.gitignore` edits.
- Move QA payment artifacts back to their original root paths.
- Restore removed disposable QA profile directories from the user's local browser/profile backup if needed; the current execution did not remove them. Do not rewrite Git history or push a cleanup commit.
- Restore any removed source asset from Git if a missed runtime reference is discovered.

## Execution note

The environment's automatic review blocked the recursive deletion of the `.qa-chrome-*` directories as a policy-rejected operation. No profile directory was removed; the directories remain tracked in the current checkout. The `.gitignore` rule only prevents re-adding them after they are untracked or removed.
