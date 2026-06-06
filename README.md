# SpoolyTracker

SpoolyTracker est une application de gestion de stock de filaments 3D, de suivi de projets, de consommation, de NFC et d'outils assistes par IA.

Ce depot public contient la partie self-host de SpoolyTracker:

- API backend;
- dashboard web;
- moteur IA;
- bridge imprimante local;
- bridge NFC local.

L'application mobile officielle, la landing page marketing et l'infrastructure de production ne font pas partie de ce depot open source. Elles sont distribuees ou maintenues separement.

## Cloud et Self-Hosted

Le service cloud officiel fonctionne sur l'infrastructure SpoolyTracker et reste l'experience recommandee pour la synchronisation mobile de production.

Le mode self-host est disponible avec Docker Compose. Quand `SELF_HOSTED=true`:

- la facturation et Stripe sont desactives;
- les quotas de plans sont desactives;
- un superadmin est cree depuis les variables d'environnement de bootstrap;
- l'image web est configurable au runtime via `/env.js`.

Voir [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Perimetre Du Depot

Inclus:

- `apps/api`
- `apps/web`
- `apps/ai-engine`
- `apps/printer-bridge`
- `apps/nfc-bridge`

Non inclus:

- source de l'application mobile officielle;
- source de la landing page marketing;
- infrastructure de deploiement production.

## Images Docker

Les images publiques sont publiees sur GHCR:

- `ghcr.io/spoolytracker/spoolytracker-api`
- `ghcr.io/spoolytracker/spoolytracker-web`
- `ghcr.io/spoolytracker/spoolytracker-ai-engine`

## Licence

Le code est publie sous licence AGPL-3.0-or-later. Le nom SpoolyTracker, les logos et les assets de marque sont couverts par la notice de marque.

---

## English

SpoolyTracker is an inventory, project, consumption, NFC, and AI-assisted tracking application for 3D printing filament.

This public repository contains the self-hosted part of SpoolyTracker:

- backend API;
- web dashboard;
- AI engine;
- local printer bridge;
- local NFC bridge.

The official mobile app, marketing landing page, and production deployment infrastructure are not part of this open source repository. They are distributed or maintained separately.

## Cloud and Self-Hosted

The official hosted service runs on SpoolyTracker infrastructure and remains the recommended production experience for mobile synchronization.

Self-hosting is supported with Docker Compose. In self-hosted mode, when `SELF_HOSTED=true`:

- billing and Stripe are disabled;
- plan quotas are disabled;
- a superadmin is created from bootstrap environment variables;
- the web image is configured at runtime through `/env.js`.

See [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

## Repository Scope

Included:

- `apps/api`
- `apps/web`
- `apps/ai-engine`
- `apps/printer-bridge`
- `apps/nfc-bridge`

Not included:

- official mobile app source;
- marketing landing page source;
- production deployment infrastructure.

## Docker Images

Public images are published to GHCR:

- `ghcr.io/spoolytracker/spoolytracker-api`
- `ghcr.io/spoolytracker/spoolytracker-web`
- `ghcr.io/spoolytracker/spoolytracker-ai-engine`

## License

Code is licensed under AGPL-3.0-or-later. SpoolyTracker names, logos, and brand assets are covered by the trademark notice.
