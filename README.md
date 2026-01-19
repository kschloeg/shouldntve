# Shouldntve

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
