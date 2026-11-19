# History

## 2026-11-19: no redeploy after the eMudhra CA fix (#2)

The ticket #2 asks to rebuild and redeploy the image after the eMudhra CA fix
of #1. It also says: "if it runs nowhere, close as not planned".

What was checked:

- The fix of #1 is on `main` (commit `356778e`, PR #3).
- No Docker host has a `pixel-invaders` image, a `pixel-invaders` container or
  a `/data/wt_data/` folder for this game. Hosts checked over ssh: pacbio01
  (r730), nuc3 and nuc8.
- The repo has no `docs/portainer/` stack file and no CI workflow.
- The only image ever built is `pixel-invaders:1.1.0` in Colima on the Mac of
  Stephane, for local play. It is older than the fix. It is not rebuilt here.
- PHP2Shell does not apply: the repo has no PHP, Go or Node code that runs on
  a server.

Result: no tag, no image build, no scan, no Portainer stack. The README Docker
section now says "Not deployed" and tells how to build a local image again
with `--pull`.
