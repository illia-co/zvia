import { useEffect, useMemo, useState } from 'react'
import type { SslNginxLink } from '@shared/ssl'
import { Button } from '@renderer/components/ui/button'
import { Checkbox } from '@renderer/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@renderer/components/ui/dialog'
import { Field } from '@renderer/components/ui/field'
import { Input } from '@renderer/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'

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
          <Field label="Domain">
            <Input
              value={domain}
              onChange={(event) => setDomain(event.target.value)}
              placeholder="example.com"
              className="mt-1 w-full font-mono"
            />
          </Field>

          <Field label="Nginx site">
            <Select
              value={configPath || undefined}
              onValueChange={(value) => setConfigPath(value)}
              disabled={siteOptions.length === 0}
            >
              <SelectTrigger className="mt-1 w-full font-mono">
                <SelectValue placeholder="No HTTP-only sites detected" />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                {siteOptions.map((site) => (
                  <SelectItem
                    key={site.configPath}
                    value={site.configPath}
                    className="font-mono"
                  >
                    {site.configPath} ({site.serverNames.join(', ')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Provider">
            <Input
              value="Let's Encrypt"
              readOnly
              className="mt-1 w-full bg-bg-secondary text-text-secondary"
            />
          </Field>

          <Field label="Email">
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
              className="mt-1 w-full font-mono"
            />
          </Field>

          <label className="flex items-center gap-2 text-xs text-text">
            <Checkbox
              checked={redirect}
              onCheckedChange={(checked) => setRedirect(checked === true)}
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
