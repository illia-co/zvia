import { useEffect, useMemo, useState } from 'react'
import type { SslNginxLink } from '@shared/ssl'
import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'

interface EnableHttpsDialogProps {
  open: boolean
  sites: SslNginxLink[]
  initialDomain?: string
  onClose: () => void
  onSubmit: (values: {
    domain: string
    configPath: string
    email: string
    redirect: boolean
  }) => void
}

export function EnableHttpsDialog({
  open,
  sites,
  initialDomain,
  onClose,
  onSubmit
}: EnableHttpsDialogProps) {
  const [domain, setDomain] = useState(initialDomain ?? '')
  const [configPath, setConfigPath] = useState('')
  const [email, setEmail] = useState('')
  const [redirect, setRedirect] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const siteOptions = useMemo(
    () =>
      sites.filter(
        (site) => site.serverNames.length > 0 && site.ports.includes(80) && !site.listensHttps
      ),
    [sites]
  )

  useEffect(() => {
    if (!open) return
    setDomain(initialDomain ?? '')
    setConfigPath(siteOptions[0]?.configPath ?? '')
    setError(null)
  }, [initialDomain, open, siteOptions])

  const handleSubmit = (): void => {
    if (!domain.trim()) {
      setError('Enter a domain name.')
      return
    }
    if (!configPath) {
      setError('Select an nginx site.')
      return
    }
    if (!email.trim()) {
      setError('Enter a contact email for Let\'s Encrypt.')
      return
    }
    setError(null)
    onSubmit({ domain: domain.trim(), configPath, email: email.trim(), redirect })
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Enable HTTPS</DialogTitle>
          <DialogDescription>
            Issue a Let&apos;s Encrypt certificate with certbot --nginx. Zvia backs up the site
            configuration first and reloads nginx only after a successful test.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Domain</span>
            <input
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2 py-1.5 font-mono text-xs text-text"
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Nginx site
            </span>
            <select
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2 py-1.5 font-mono text-xs text-text"
              value={configPath}
              onChange={(event) => setConfigPath(event.target.value)}
            >
              {siteOptions.length === 0 ? (
                <option value="">No HTTP-only sites detected</option>
              ) : (
                siteOptions.map((site) => (
                  <option key={site.configPath} value={site.configPath}>
                    {site.configPath} ({site.serverNames.join(', ')})
                  </option>
                ))
              )}
            </select>
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
              Provider
            </span>
            <input
              className="mt-1 w-full rounded-panel border border-divider bg-bg-secondary px-2 py-1.5 text-xs text-text-secondary"
              value="Let's Encrypt"
              readOnly
            />
          </label>

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary">Email</span>
            <input
              className="mt-1 w-full rounded-panel border border-divider bg-bg px-2 py-1.5 font-mono text-xs text-text"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-text">
            <input
              type="checkbox"
              checked={redirect}
              onChange={(event) => setRedirect(event.target.checked)}
            />
            Redirect HTTP to HTTPS
          </label>

          {error && <p className="text-xs text-status-error">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={siteOptions.length === 0} onClick={handleSubmit}>
            Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
