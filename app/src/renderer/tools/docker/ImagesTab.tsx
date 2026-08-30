import { useCallback, useEffect, useState } from 'react'
import type { DockerImage } from '@shared/docker'
import type { ServerId } from '@shared/server'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { ErrorSurface } from '@renderer/components/errors/ErrorSurface'
import { parseZviaError } from '@renderer/lib/errors'

interface ImagesTabProps {
  serverId: ServerId
  isConnected: boolean
}

export function ImagesTab({ serverId, isConnected }: ImagesTabProps) {
  const [images, setImages] = useState<DockerImage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingImage, setPendingImage] = useState<DockerImage | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const loadImages = useCallback(async () => {
    if (!isConnected) return
    setLoading(true)
    setError(null)
    try {
      const result = await window.zvia.docker.listImages({ serverId })
      setImages(result)
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setLoading(false)
    }
  }, [isConnected, serverId])

  useEffect(() => {
    void loadImages()
  }, [loadImages])

  const confirmRemove = async () => {
    if (!pendingImage) return
    setActionLoading(true)
    setError(null)
    try {
      await window.zvia.docker.removeImage({
        serverId,
        imageId: pendingImage.id,
        force: true
      })
      setPendingImage(null)
      await loadImages()
    } catch (err) {
      setError(parseZviaError(err).message)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-end border-b border-divider px-3 py-2">
        <Button variant="ghost" size="sm" onClick={() => void loadImages()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="border-b border-divider p-3">
          <ErrorSurface error={error} onDismiss={() => setError(null)} />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {loading && images.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">Loading images…</p>
        ) : images.length === 0 ? (
          <p className="p-6 text-center text-xs text-text-secondary">No images found.</p>
        ) : (
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-bg-secondary text-[10px] uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="px-3 py-2 font-medium">Repository</th>
                <th className="px-3 py-2 font-medium">Tag</th>
                <th className="px-3 py-2 font-medium">Image ID</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {images.map((image) => (
                <tr key={image.id} className="border-t border-divider">
                  <td className="px-3 py-2 text-text">{image.repository}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{image.tag}</td>
                  <td className="px-3 py-2 font-mono text-text-secondary">{image.id}</td>
                  <td className="px-3 py-2 text-text-secondary">{image.size}</td>
                  <td className="px-3 py-2 text-text-secondary">{image.created}</td>
                  <td className="px-3 py-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-status-error hover:text-status-error"
                      onClick={() => setPendingImage(image)}
                    >
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={pendingImage !== null} onOpenChange={(open) => !open && setPendingImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove image</DialogTitle>
            <DialogDescription>
              Remove <span className="font-mono">{pendingImage?.repository}:{pendingImage?.tag}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setPendingImage(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={actionLoading}
              onClick={() => void confirmRemove()}
            >
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
