import { runSeed } from '../seed/runner.js'

async function main() {
  const dry = !!process.env.SEED_DRY
  const withAI = !!process.env.OPENAI_API_KEY && process.env.SEED_WITH_AI !== 'false'
  const res = await runSeed({ dry, withAI })
  console.log(`Seed complete${dry ? ' (dry)' : ''}: trends=${res.trends} creators=${res.creators} assets=${res.assets}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
