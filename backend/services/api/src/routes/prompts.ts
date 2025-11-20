import { Router } from 'express'
import { listPrompts, getPrompt, setPrompt } from '../services/promptStore.js'

const router = Router()

router.get('/', async (_req, res) => {
  const list = await listPrompts()
  res.json(list)
})

router.get('/:key', async (req, res) => {
  try {
    const key = req.params.key as any
    const content = await getPrompt(key)
    res.json({ key, content })
  } catch (e: any) {
    res.status(400).json({ error: 'invalid key' })
  }
})

router.put('/:key', async (req, res) => {
  const key = req.params.key as any
  const content = String(req.body?.content || '')
  if (!content) return res.status(400).json({ error: 'content required' })
  try {
    await setPrompt(key, content)
    res.json({ ok: true })
  } catch (e: any) {
    res.status(400).json({ error: 'invalid key' })
  }
})

export default router

