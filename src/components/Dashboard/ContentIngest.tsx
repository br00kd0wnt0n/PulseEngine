import UploadDropzone from '../Upload/UploadDropzone'
import { useUpload } from '../../context/UploadContext'

export default function ContentIngest() {
  const { processed } = useUpload()
  return (
    <div className="panel module p-4 transform-gpu">
      <div className="flex items-center justify-between mb-3">
        <div className="font-semibold">Content Upload & Processing</div>
        <div className="text-xs text-white/60">{processed.length} item{processed.length === 1 ? '' : 's'} processed</div>
      </div>
      <UploadDropzone />
    </div>
  )
}
