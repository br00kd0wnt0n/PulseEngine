import KnowledgeBaseBuilder from '../components/Admin/KnowledgeBaseBuilder'

export default function RKB() {
  return (
    <div className="space-y-4">
      <div className="panel module p-4">
        <div className="font-semibold">Ralph Knowledge Base</div>
        <div className="text-xs text-white/60">Upload and curate internal knowledge to inform AI assessments.</div>
      </div>
      <KnowledgeBaseBuilder />
    </div>
  )
}

