# SSL Specification

View and manage TLS certificates on the selected server.

## Display

- certificate list with domain, issuer, expiry
- certificate detail view

## Actions

- enable HTTPS via Certbot when available
- test renewal
- configure auto-renewal where supported

## Behavior

If Certbot is not installed, guide the user — do not install silently.

## Implementation

- Panel: `app/src/renderer/tools/ssl/`
- Service: `app/src/main/services/SSLService.ts`
