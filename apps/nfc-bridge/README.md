# Spooly NFC Bridge 📡

Application de pont ("Bridge") pour connecter un lecteur NFC USB (PC/SC) à l'application web Spooly via WebSocket.

## 🚀 Lancement Rapide

### Pour le développement (recommandé si le build échoue)
1.  Assurez-vous que les dépendances sont installées :
    ```bash
    npm install
    ```
2.  Lancez l'application directement depuis les sources :
    ```bash
    npm start
    ```
    *(Ou utilisez le script `run-bridge.bat` à la racine du projet)*

---

## 📦 Création de l'Exécutable (Build)

Pour créer un fichier `.exe` autonome (ou `.dmg` / `.AppImage`) :

```bash
npm run dist
```

Les fichiers générés se trouveront dans le dossier `dist-final/win-unpacked` (ou `dmg`/`AppImage` selon l'OS).

> **Note importante** : Si le build échoue avec une erreur "Access Denied" ou "File Locked", cela signifie souvent qu'un antivirus ou un processus fantôme bloque le dossier.

---

## 🛠️ Dépannage

### Erreur "Address already in use"
Si vous voyez cette erreur, cela signifie qu'une ancienne instance du bridge tourne encore en fond.
1.  Fermez toutes les fenêtres Spooly Bridge.
2.  Exécutez le script **`kill-bridge.bat`** (à la racine) pour forcer l'arrêt de tous les processus Node/Electron.
3.  Relancez l'application.

### Erreur de Build (File Locked)
Si `npm run dist` échoue :
1.  Lancez `kill-bridge.bat`.
2.  Supprimez manuellement le dossier `apps/nfc-bridge/dist-final`.
3.  Relancez la commande.

### Modifier l'icône
L'icône de l'application se trouve dans `apps/nfc-bridge/icon.png`. Si vous la remplacez, relancez un build pour que le `.exe` prenne la nouvelle icône.
