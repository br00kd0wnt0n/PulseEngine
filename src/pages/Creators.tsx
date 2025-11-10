import CreatorCard from '../components/Creators/CreatorCard'
import { useCreators } from '../context/CreatorContext'

export default function Creators() {
  const { creators, recommended } = useCreators()
  return (
    <div className="space-y-6">
      <div className="panel p-4">
        <div className="font-semibold mb-2">Recommended Collaborators</div>
        <div className="grid md:grid-cols-2 gap-3">
          {recommended.map(c => <CreatorCard key={c.id} c={c} />)}
        </div>
      </div>

      <div className="panel p-4">
        <div className="font-semibold mb-2">All Creators</div>
        <div className="grid md:grid-cols-2 gap-3">
          {creators.map(c => <CreatorCard key={c.id} c={c} />)}
        </div>
      </div>
    </div>
  )
}

