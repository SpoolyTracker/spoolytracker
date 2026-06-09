# Open Source Release Procedure

Use a new public repository with a clean first commit.

## Steps

1. Prepare and test changes on the private branch `prepare-open-source-selfhost`.
2. Keep only the public self-host scope in the tracked tree.
3. Remove local secrets and private runtime files from the tracked tree.
4. Rotate any credential that was ever committed in the private history.
5. Export the cleaned tree into a new empty public repository.
6. Commit the cleaned tree as the first public commit.
7. Enable GitHub Actions package publishing.
8. Run the Docker publish workflow.

## Public Scope

Published:

- `apps/api`
- `apps/web`
- `apps/ai-engine`
- `apps/printer-bridge`
- `apps/nfc-bridge`
- self-host Docker, docs, and public CI workflows

Not published:

- `apps/mobile`
- `apps/landing`
- production deployment infrastructure

## Files That Must Not Be Published

- `.env` and `.env.*`
- SQLite databases
- real Firebase `google-services*.json`
- real bridge configs such as `printers.json`
- production deploy keys or OVH deployment files
- local caches, `.venv`, `node_modules`, build outputs

## Verification

```bash
git ls-files | rg "(\.env|google-services|printers\.json|\.sqlite|\.bak)"
rg -n "(SECRET|PASSWORD|API_KEY|TOKEN|STRIPE|SMTP|OPENAI|private_key)"
docker compose --env-file .env.selfhost -f docker-compose.selfhost.yml up --build
```
