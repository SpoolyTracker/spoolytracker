# SpoolyTracker

SpoolyTracker is an inventory, project, consumption, NFC, and AI-assisted tracking application for 3D printing filament.

This public repository contains the API, web dashboard, AI engine, and local bridge clients.

The official mobile app and marketing landing page are distributed separately and are not part of this open source self-host repository.

## Cloud and Self-Hosted

The official hosted service runs on SpoolyTracker infrastructure and powers the production mobile synchronization experience.

Self-hosting is supported with Docker Compose. In self-hosted mode:

- `SELF_HOSTED=true` disables billing and Stripe.
- Plan quotas are disabled.
- A superadmin is created from bootstrap environment variables.
- The web image is configured at runtime through `/env.js`.

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Repository Scope

Included:

- `apps/api`
- `apps/web`
- `apps/ai-engine`
- `apps/printer-bridge`
- `apps/nfc-bridge`

Not included:

- official mobile app source
- marketing landing page source
- production deployment infrastructure

## Docker Images

Public images are intended to be published to GHCR:

- `ghcr.io/spoolytracker/spoolytracker-api`
- `ghcr.io/spoolytracker/spoolytracker-web`
- `ghcr.io/spoolytracker/spoolytracker-ai-engine`

## License

Code is licensed under AGPL-3.0-or-later. SpoolyTracker names, logos, and brand assets are covered by the trademark notice.
