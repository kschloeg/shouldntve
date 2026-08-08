# Shouldntve

## Build

```bash
npm install

cd packages/frontend
npm run build

cd ../../packages/frontend-deploy
npm run cdk deploy

cd ../../packages/backend
npm run build
npm run cdk deploy
```

## Test

```bash
cd packages/frontend
npm run test
```
