# SageMaker gesture simulator

This package is dry-run first. It creates bounded Processing or Training API
specifications locally; it does not upload data, publish images, or start jobs
unless `--execute` is supplied and the numeric approval covers the full bounded
estimate.

1. Copy `config.example.json` to the untracked `config.local.json` and fill in
   the private AWS resource values.
2. Run the read-only preflight. Its output contains booleans and exception class
   names only—never account IDs, ARNs, bucket names, registry hosts, or tokens.
3. Build the simulator image from the repository root. The Dockerfile copies
   only the gesture generator, source-manifest utility, frozen source manifest,
   and entrypoint; the container runs as the non-root `node` user.
4. Render a redacted dry run with `jobs.py processing --config ...`.

The smoke configuration is one `ml.m5.large` for at most 1,800 seconds. A real
submission is deliberately blocked until the operator supplies a numeric
`--approved-cost-usd` at least as high as the computed ceiling. Synthetic
results are not production or real-user accuracy.

## Failure-state behavior

- Missing local config: no AWS client is created and no resource is guessed.
- Missing/expired credentials or permissions: read-only preflight returns only
  a failure class and false checks; it never prints identity or resource values.
- Unversioned or unencrypted storage, unreadable ECR, missing SageMaker list
  permission, unavailable Docker, or a credential-like build-context file:
  preflight fails and the workflow must not publish or submit.
- Missing, zero, or insufficient numeric cost approval: submission raises
  `CostApprovalError` before the client mutation method can run.
- Container failure: nonzero generation/audit/freeze status propagates and
  SageMaker does not upload a successful output artifact.
- Output-path escape: the container aborts before generation.
