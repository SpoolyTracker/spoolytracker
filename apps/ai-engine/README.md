# Spooly AI Engine

Service FastAPI autonome pour l'assistant IA Spooly.

Le moteur fonctionne sans LLM par defaut. Il peut utiliser les donnees reelles de l'API principale via `GET /ai/context`, avec fallback demo/offline si l'API est indisponible. Les actions sensibles restent controlees: l'IA propose, l'utilisateur valide, puis l'action est executee en mode mock pour le moment.

## Modes

- `none`: mode recommande en production au debut, aucun LLM.
- `mock`: provider LLM factice pour tests et UI.
- `ollama`: LLM local via un conteneur Ollama separe.

Le moteur reste fonctionnel meme si aucun LLM n'est disponible.

## Architecture Docker

En production Docker, les services attendus sont:

- `api`: API NestJS principale.
- `web`: interface React.
- `ai-engine`: moteur FastAPI.
- `postgres`, `redis`.
- `ollama`: optionnel, uniquement si `AI_LLM_PROVIDER=ollama`.

Le navigateur appelle `VITE_AI_ENGINE_URL`. Le moteur IA appelle ensuite l'API principale avec le JWT utilisateur recu du web.

Flux:

```txt
web -> ai-engine -> api /ai/context
```

Le moteur IA doit donc etre expose publiquement en HTTPS, ou route par le meme reverse proxy que le dashboard.

## Installation Locale

Depuis le dossier `apps/ai-engine`:

```powershell
python -m venv .venv
.\.venv\Scripts\activate
pip install -e ".[dev]"
copy .env.example .env
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000
```

Variables minimales dans `.env`:

```env
AI_ENGINE_ENV=local
AI_ENGINE_APP_API_URL=http://localhost:3000
AI_LLM_PROVIDER=none
AI_ENGINE_MEMORY_DB_PATH=ai_engine_memory.sqlite3
AI_ENGINE_CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

Tester le statut:

```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health"
```

Pour utiliser les vraies donnees en CLI, il faut passer un JWT utilisateur:

```powershell
$login = Invoke-RestMethod -Method POST -Uri "http://localhost:3000/auth/login" -ContentType "application/json" -Body (@{ username="USER"; password="PASSWORD" } | ConvertTo-Json)

$headers = @{
  "Authorization" = "Bearer $($login.access_token)"
  "x-workspace-id" = "$($login.activeOrganizationId)"
  "x-user-id" = "$($login.user.id)"
  "x-plan" = "pro"
}

Invoke-RestMethod -Uri "http://localhost:8000/status" -Headers $headers
```

Resultat attendu:

```txt
data_source   : main_api
api_connected : True
mode          : api
```

Si `data_source=mock_fallback`, regarder `fallback_reason`.

## Docker Compose

Depuis la racine du monorepo:

```powershell
docker compose up --build ai-engine
```

Le `docker-compose.yml` configure par defaut:

```env
AI_ENGINE_APP_API_URL=http://api:3000
AI_LLM_PROVIDER=none
AI_ENGINE_MEMORY_DB_PATH=/app/data/ai_engine_memory.sqlite3
```

Le volume `ai_engine_data` conserve la memoire SQLite.

## Ajouter Ollama Sans Installation Serveur

Ne pas installer Ollama sur l'hote. Utiliser un conteneur separe.

Ajouter ce service dans `docker-compose.yml` si tu veux activer un LLM local:

```yaml
ollama:
  image: ollama/ollama:latest
  restart: unless-stopped
  volumes:
    - ollama_data:/root/.ollama
  ports:
    - "11434:11434"
```

Ajouter le volume:

```yaml
volumes:
  ollama_data:
    driver: local
```

Configurer `ai-engine`:

```env
AI_LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
AI_ALLOW_SENSITIVE_LLM_CONTEXT=false
```

Ajouter une dependance optionnelle:

```yaml
ai-engine:
  depends_on:
    - api
    - ollama
```

Demarrer:

```bash
docker compose up -d ollama ai-engine
```

Telecharger le modele une fois:

```bash
docker compose exec ollama ollama pull llama3.2
```

Verifier:

```bash
docker compose exec ai-engine python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8000/status').read().decode())"
```

Note: Ollama consomme RAM/CPU/GPU selon le modele. En prod, garder `AI_LLM_PROVIDER=none` tant que le serveur n'est pas dimensionne.

## Reverse Proxy

Le web doit appeler une URL publique, jamais `localhost`, en production.

Exemples valides:

```env
VITE_AI_ENGINE_URL=https://ai.spoolytracker.com
AI_ENGINE_CORS_ORIGINS=https://app.spoolytracker.com
```

Ou via le meme domaine:

```env
VITE_AI_ENGINE_URL=https://app.spoolytracker.com/ai-engine
AI_ENGINE_CORS_ORIGINS=https://app.spoolytracker.com
```

Dans ce cas, le reverse proxy doit router `/ai-engine/*` vers `ai-engine:8000`.

Attention: si le dashboard est en HTTPS, l'URL IA doit aussi etre HTTPS, sinon le navigateur bloque en mixed content.

## GitHub Actions

Le workflow `deploy.yml` build et push maintenant:

- API
- Web
- Landing
- AI Engine

Variables a definir dans les environnements GitHub `staging` et `production`.

Obligatoires:

```txt
VITE_AI_ENGINE_URL=https://url-publique-du-moteur-ia
AI_ENGINE_CORS_ORIGINS=https://url-du-dashboard
AI_LLM_PROVIDER=none
AI_ALLOW_SENSITIVE_LLM_CONTEXT=false
```

Optionnelles pour Ollama:

```txt
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
```

Secrets deja necessaires au deploy existant:

```txt
OVH_SSH_HOST
OVH_SSH_USER
OVH_SSH_KEY
GH_PAT
JWT_SECRET
VITE_API_URL
REDIS_PASSWORD
SMTP_USER
SMTP_PASS
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
STRIPE_ENTERPRISE_PRICE_ID
```

Pas besoin de secret specifique pour l'auth utilisateur IA: le web transmet le JWT utilisateur au moteur IA, et le moteur le relaie a l'API.

## Variables Moteur IA

```env
AI_ENGINE_ENV=production
AI_ENGINE_DEBUG=false
AI_ENGINE_MEMORY_DB_PATH=/app/data/ai_engine_memory.sqlite3
AI_ENGINE_APP_API_URL=http://api:3000
AI_ENGINE_APP_API_TOKEN=
AI_ENGINE_CORS_ORIGINS=https://app.spoolytracker.com

AI_LLM_PROVIDER=none
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama3.2
AI_ALLOW_SENSITIVE_LLM_CONTEXT=false
```

`AI_ENGINE_APP_API_TOKEN` est optionnel. Le flux normal utilise le JWT utilisateur.

## Endpoints

- `GET /health`: sante simple du service.
- `GET /status`: sante complete, source des donnees, API connectee, LLM.
- `GET /capabilities`: capacites Free/Pro et LLM.
- `POST /chat`: assistant IA.
- `POST /actions/propose`: proposer une action controlee.
- `POST /actions/{id}/approve`: approuver une action.
- `POST /actions/{id}/reject`: refuser une action.
- `POST /memory`: creer une memoire.
- `GET /memory`: lister les memoires.
- `DELETE /memory/{id}`: supprimer une memoire.
- `POST /feedback`: enregistrer un feedback.
- `GET /forecast/stock`: previsions Pro.
- `GET /forecast/stock/{item_id}`: prevision d'une bobine.
- `GET /risks`: risques stock/projets.
- `GET /notifications/proposals`: notifications proactives proposees.

## Free vs Pro

Free:

- Questions stock.
- Stock faible.
- Aide a la saisie de consommation.
- Proposition d'actions controlees.
- Questions projet simples.
- Memoire locale.

Pro:

- Date de rupture estimee.
- Consommation moyenne.
- Detection d'anomalies.
- Materiaux a risque.
- Recommandation d'achat.
- Projets a risque.
- Notifications proactives.

Les endpoints Pro exigent:

```txt
x-plan: pro
```

## Actions Controlees

L'IA ne modifie pas directement les donnees sensibles.

Workflow:

```txt
chat -> proposed action -> approve/reject -> execution mockee
```

Statuts:

- `proposed`
- `approved`
- `rejected`
- `executed`
- `failed`

Actions supportees:

- `create_consumption`
- `update_stock_threshold`
- `create_alert`
- `propose_supplier_order`
- `link_consumption_to_project`
- `prepare_notification`

Note: l'execution reelle des actions API n'est pas encore branchee. L'approbation execute en mode mock et ecrit l'audit log.

## Memoire Locale

La memoire utilise SQLite via:

```env
AI_ENGINE_MEMORY_DB_PATH=/app/data/ai_engine_memory.sqlite3
```

Types:

- `preference`
- `correction`
- `learned_rule`
- `feedback`

Chaque memoire est isolee par:

- `x-workspace-id`
- `x-user-id`

Le chat capture automatiquement des phrases comme:

- `Souviens-toi que mon seuil minimum de PLA noir est 2kg`
- `je veux garder une reserve de 200g de PLA Matte AtomeBlue`
- `Non, ce projet consomme plutot 1.2kg`
- `Cette recommandation n'est pas utile`

## Securite

- LLM desactive par defaut.
- Les donnees reelles viennent de l'API principale avec JWT utilisateur.
- Les actions sensibles demandent validation.
- Audit log pour proposition, approbation, rejet, execution, refus.
- Memoire et actions isolees par workspace/user.
- Les donnees sensibles ne sont pas envoyees au LLM sauf si `AI_ALLOW_SENSITIVE_LLM_CONTEXT=true`.

## Checks De Deploiement

Apres deploy:

```bash
curl https://ai.spoolytracker.com/health
```

Puis depuis le web, verifier le badge header:

- `IA API`: OK, donnees reelles.
- `IA mock`: moteur actif mais fallback demo/offline.
- `IA off`: moteur indisponible.

Si `IA mock`, ouvrir le tooltip et lire:

- `api_base_url`
- `fallback_reason`

Ca indique generalement:

- JWT manquant ou invalide.
- CORS mal configure.
- `AI_ENGINE_APP_API_URL` incorrect.
- API principale indisponible.

## Tests

```powershell
cd apps/ai-engine
python -m pytest -p no:cacheprovider
```

## Layout

- `src/api`: routes FastAPI.
- `src/core`: configuration.
- `src/agents`: assistant deterministe.
- `src/actions`: actions controlees et audit.
- `src/tools`: outils metier types.
- `src/memory`: memoire locale.
- `src/forecasting`: previsions deterministes.
- `src/integrations`: client API principale.
- `src/security`: contexte workspace/user/plan.
- `tests`: tests unitaires et scenarios demo.
