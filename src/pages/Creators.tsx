import CreatorCard from '../components/Creators/CreatorCard'
import { useCreators } from '../context/CreatorContext'

export default function Creators() {
  const { creators } = useCreators()
  return (
    <div className="space-y-6">
      <div className="panel p-4">
        <div className="font-semibold mb-2">All Creators</div>
        <div className="text-xs text-white/60 mb-3">
          Browse all available creators in the database, independent of any specific project or brief.
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
          {creators.map(c => <CreatorCard key={c.id} c={c} />)}
        </div>
      </div>
    </div>
  )
}

