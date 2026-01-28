# Shouldntve

## Important Dependencies Note

**Do not add `minimatch` v6+ to root package.json dependencies.**

The pnpm override `"minimatch@>=6": "5.1.6"` is critical for aws-cdk-lib compatibility.
AWS CDK versions 2.178.0-2.179.0 require minimatch v5.x or earlier. Newer versions (6+)
changed the export structure causing `minimatch(...) is not a function` errors during deployment.

If you see this error again:

- Check that minimatch isn't in root dependencies
- Verify the pnpm override in package.json is still present

## Build

```bash
pnpm i

cd packages/frontend
pnpm run build

cd ../../packages/frontend-deploy
pnpm run cdk deploy

cd ../../packages/backend
pnpm run build
pnpm run cdk deploy
```

## Test

```bash
cd packages/frontend
pnpm run test
```
