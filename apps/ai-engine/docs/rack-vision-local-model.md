# Entrainer l'IA locale de scan rack

Cette doc explique comment entrainer le modele local utilise par Spool IA pour compter les bobines sur une photo de rack.

Le moteur utilise YOLO en local dans `ai-engine`. Le modele detecte une seule classe:

- `spool`: une bobine visible sur un rack.

Quand le fichier `models/rack-spool-detector.pt` existe, l'endpoint `/vision/rack-ocr` l'utilise automatiquement avant OpenAI Vision et avant le fallback heuristique.

## 1. Objectif

Le modele doit apprendre a dessiner une boite autour de chaque bobine visible.

Il doit fonctionner avec:

- petits racks et gros racks;
- 1, 2, 3, 4 rangees ou plus;
- bobines arc-en-ciel, noires, blanches, grises, transparentes, multicolor;
- photos mobiles reelles: angle, ombre, reflet, crop partiel, fond pas parfait.

Important: on n'annote pas les rails, les crochets, les roues, les emplacements vides ou les supports.

## 2. Demarrer Label Studio

Depuis un dossier de travail sur ton PC:

```powershell
docker run -it -p 1208:8080 -v ${PWD}/mydata:/label-studio/data heartexlabs/label-studio:latest
```

Puis ouvrir:

```text
http://localhost:1208
```

## 3. Creer le projet Label Studio

Dans Label Studio:

1. Creer un nouveau projet.
2. Importer les photos de rack.
3. Configurer l'interface d'annotation en detection d'objet.
4. Creer un seul label: `spool`.
5. Pour chaque image, dessiner un rectangle autour de chaque bobine visible.

Regle pratique:

- La boite doit entourer le corps de la bobine et ses flasques visibles.
- Si une bobine est partiellement coupee par le bord de l'image mais identifiable, on l'annote.
- Si une bobine est cachee a plus de 70%, on evite de l'annoter.
- Si deux bobines se touchent, on fait quand meme deux boites separees.

## 4. Quantite d'images conseillee

Pour un premier modele utilisable:

```text
80 a 150 photos annotees
```

Pour un modele vraiment robuste:

```text
300+ photos annotees
```

Repartition conseillee:

- 70% train
- 20% val
- 10% test

Si tu n'as pas beaucoup d'images au debut, fais au minimum `train` et `val`.

## 5. Exporter depuis Label Studio

Exporter le projet en format YOLO.

Le dataset doit finir dans cette structure:

```text
apps/ai-engine/datasets/rack-spools/
  data.yaml
  images/
    train/
    val/
    test/
  labels/
    train/
    val/
    test/
```

Exemple de `data.yaml`:

```yaml
path: ./datasets/rack-spools
train: images/train
val: images/val
test: images/test

names:
  0: spool
```

Chaque image doit avoir un fichier label `.txt` du meme nom.

Exemple:

```text
images/train/rack-001.jpg
labels/train/rack-001.txt
```

Chaque ligne du `.txt` represente une bobine:

```text
0 x_center y_center width height
```

Les valeurs sont normalisees entre `0` et `1`.

## 6. Installer les dependances vision

Depuis `apps/ai-engine`:

```powershell
.venv\Scripts\python.exe -m pip install -e .[vision]
```

Si tu es sur Linux serveur:

```bash
python -m pip install -e '.[vision]'
```

## 7. Entrainer le modele

Depuis `apps/ai-engine`:

```powershell
.venv\Scripts\python.exe -m src.vision.train_rack_detector --data datasets/rack-spools/data.yaml --epochs 80 --imgsz 960 --batch 8
```

Le script entraine YOLO puis copie le meilleur modele ici:

```text
apps/ai-engine/models/rack-spool-detector.pt
```

Parametres utiles:

- `--epochs 80`: nombre de cycles d'entrainement.
- `--imgsz 960`: taille des images pendant l'entrainement.
- `--batch 8`: nombre d'images traitees en meme temps.
- `--base yolov8n.pt`: modele de depart leger.

Si ton PC manque de RAM/GPU:

```powershell
.venv\Scripts\python.exe -m src.vision.train_rack_detector --data datasets/rack-spools/data.yaml --epochs 60 --imgsz 640 --batch 4
```

## 8. Tester en local

Redemarrer `ai-engine`, puis refaire un scan depuis le mobile.

Si le modele local est utilise, la reponse doit contenir:

```json
{
  "status": "processed",
  "debug": {
    "engine": "local_yolo"
  }
}
```

Dans les logs `ai-engine`, tu dois voir:

```text
rack_ocr_local_model model=... spool_count=...
```

Si tu vois encore:

```json
{
  "status": "needs_vision_model"
}
```

Alors le modele n'est pas trouve, ou `ultralytics` n'est pas installe dans l'environnement qui lance `ai-engine`.

## 9. Deployer sur le serveur

Le fichier important est:

```text
apps/ai-engine/models/rack-spool-detector.pt
```

Il faut l'envoyer sur le serveur au meme chemin dans l'app/container:

```text
/app/models/rack-spool-detector.pt
```

Variables d'environnement serveur:

```env
RACK_VISION_MODEL_PATH=/app/models/rack-spool-detector.pt
RACK_VISION_CONFIDENCE=0.35
```

Puis rebuild/restart:

```bash
docker compose up -d --build ai-engine
```

Verifier les logs:

```bash
docker compose logs -f ai-engine
```

## 10. Ameliorer le modele

Si le modele rate des bobines:

1. Garder les photos ratees.
2. Les ajouter au dataset.
3. Annoter les bobines correctement.
4. Relancer l'entrainement.
5. Redeployer `rack-spool-detector.pt`.

C'est normal de faire plusieurs boucles.

Le dataset ideal contient beaucoup de cas difficiles:

- bobines noires sur rack noir;
- bobines blanches sur fond blanc;
- racks tres denses;
- bobines multicolor;
- photos floues;
- photos avec reflet;
- rack coupe sur le cote;
- angles de prise de vue mobile.

## 11. Peut-on utiliser une IA pour annoter ?

Oui, mais il faut etre prudent.

Une IA comme Claude, OpenAI Vision, ou un autre modele peut aider a pre-annoter:

- proposer le nombre de bobines;
- proposer des boites approximatives;
- proposer les couleurs;
- aider a reperer les images ratees.

Mais il ne faut pas entrainer directement sur des annotations non verifiees.

Pourquoi:

- si l'IA oublie 3 bobines, ton modele apprend a les oublier;
- si l'IA annote les rails comme des bobines, ton modele apprend cette erreur;
- si les boites sont trop larges, les couleurs detectees seront polluees par le rack.

Le bon workflow est:

```text
IA pre-annote -> humain corrige -> export YOLO -> entrainement
```

Donc oui, on pourra ajouter plus tard un outil web Spooly:

1. upload photo;
2. pre-annotation par IA;
3. correction manuelle des rectangles;
4. export dataset YOLO;
5. bouton entrainer;
6. deploiement du nouveau modele.

Mais pour commencer vite, Label Studio est plus simple.

## 12. Checklist rapide

```text
[ ] Installer Label Studio
[ ] Importer les photos rack
[ ] Annoter une box spool par bobine
[ ] Exporter en YOLO
[ ] Mettre le dataset dans apps/ai-engine/datasets/rack-spools
[ ] Verifier data.yaml
[ ] Installer .[vision]
[ ] Lancer train_rack_detector
[ ] Recuperer models/rack-spool-detector.pt
[ ] Redemarrer ai-engine
[ ] Verifier debug.engine = local_yolo
[ ] Deployer le .pt sur le serveur
```
