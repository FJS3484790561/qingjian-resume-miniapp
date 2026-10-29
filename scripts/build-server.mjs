import { build } from 'esbuild'

await build({ entryPoints: ['server/index.ts'], outfile: 'dist/server/index.cjs', bundle: true,
  platform: 'node', target: 'node22', format: 'cjs', packages: 'external', sourcemap: false })
console.log('服务端已打包至 dist/server/index.cjs；运行不需要 tsx 或前端源码。')
