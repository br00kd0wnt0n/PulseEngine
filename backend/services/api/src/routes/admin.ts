import { Router } from 'express'
import { runSeed } from '../seed/runner.js'

const router = Router()

router.post('/seed', async (req, res) => {
  // Optional seed token protection (only enforced if SEED_TOKEN env var is set)
  const token = req.header('x-seed-token')
  const required = process.env.SEED_TOKEN
  if (required && token !== required) {
    return res.status(401).json({ error: 'unauthorized: x-seed-token required' })
  }
  const dry = !!req.body?.dry
  const withAI = !!process.env.OPENAI_API_KEY && req.body?.withAI !== false
  try {
    const result = await runSeed({ dry, withAI })
    res.json({ ok: true, result })
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) })
  }
})

export default router

