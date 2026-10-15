# Settings Specification

Settings is scoped to the selected server.

If:

    Production

is selected, Settings manages Production only.

---

# Navigation

Settings contains:

    Permissions

---

# Permissions

Capability-based passwordless sudo management. The user toggles
capabilities, never commands: the app owns a hardcoded map from capability
→ privileged operation (`Service.method`) → exact sudoers command lines
(`shared/permissions.ts`).

Rows show a danger badge (low / medium / high / critical), a live
server-truth status probed via a single side-effect-free `sudo -n -l`
listing — `Not in draft` (not selected), `Pending` (selected locally, not
granted on the server yet), `Still granted` (deselected locally but still
granted on the server), or `Granted` — the operations each capability
unlocks, and a disclosure with the exact commands for transparency. A
divergence banner appears whenever the draft differs from the server in
either direction, and a header "Reset to server" button restores every
checkbox to what the server actually grants. When the server grants
unrestricted NOPASSWD (`ALL`, e.g. via another sudoers file), the screen says
so plainly and hides the divergence banner — every capability is already
granted and the draft changes nothing.

Presentation tiers, in order:

- Read-only (inspect without changing anything)
- Service control (restart/reload; connections may be interrupted)
- Operational (day-to-day changes, mostly reversible)
- System administration (root-equivalent: cron writes, packages, users,
  nginx config writes) behind an Advanced / Dangerous collapsible

Header shows "N of M in local policy draft" plus a save indicator
(`Saving…` / `Unsaved draft` / `Draft saved`, compared against the last
confirmed local write); toggling a capability only edits the draft. A pending banner
counts draft entries not granted on the server yet. The footer is the
Policy draft preview with Copy, Continue in Terminal and Re-check.

Capability groups:

- Nginx: view config, test config, reload, restart, start/stop, write config
- SSL: read certificates, inspect details, renewal config, renewal logs, renew
- Services: control of explicitly picked units only
- Processes: signal other users' processes
- Packages: APT install/remove/upgrade
- Users: manage non-protected users
- Firewall: view rules, change rules
- Cron: view/write root crontab

Terminal-only flows (listed with reasons, no toggle): Certbot install
(compound shell command) and HTTPS enablement (dynamic domain/email would
need over-broad wildcards).

Footer: generated `user ALL=(root) NOPASSWD: …` policy preview with the
server username, config root and chosen units interpolated; Copy; Continue
in Terminal (`sudo VISUAL=nano EDITOR=nano visudo -f … && sudo chmod 0440 … && sudo visudo -c`
prefill — nano forced (visudo defaults to vi), sudo ignores sudoers.d files unless they are exactly mode 0440);
Re-check (re-probes and clears the privilege cache). Choices persist per server in
`permissions.json`. The app never applies sudoers itself: writing sudoers
needs the elevation being granted (chicken-egg), so Apply is always manual
via Terminal.

Elevation banners across tools link here via the `settings` tool intent.
