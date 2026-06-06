# Activation des Chemins Longs Windows

## Étapes pour activer les chemins longs

### Méthode 1 : Via PowerShell (Recommandé)

1. **Ouvrir PowerShell en tant qu'administrateur** :
   - Cliquer sur le menu Démarrer
   - Taper "PowerShell"
   - Clic droit sur "Windows PowerShell"
   - Sélectionner "Exécuter en tant qu'administrateur"

2. **Exécuter cette commande** :
```powershell
New-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
```

3. **Redémarrer l'ordinateur** (obligatoire)

### Méthode 2 : Via l'Éditeur de Registre

1. Appuyer sur `Win + R`
2. Taper `regedit` et appuyer sur Entrée
3. Naviguer vers :
   ```
   HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Control\FileSystem
   ```
4. Créer ou modifier la valeur DWORD `LongPathsEnabled`
5. Définir la valeur à `1`
6. Redémarrer l'ordinateur

### Méthode 3 : Via la Stratégie de Groupe (Windows Pro/Enterprise)

1. Appuyer sur `Win + R`
2. Taper `gpedit.msc` et appuyer sur Entrée
3. Naviguer vers :
   ```
   Configuration ordinateur > Modèles d'administration > Système > Système de fichiers
   ```
4. Double-cliquer sur "Activer les chemins d'accès longs Win32"
5. Sélectionner "Activé"
6. Cliquer sur OK
7. Redémarrer l'ordinateur

## Vérification

Après le redémarrage, vérifiez que c'est activé :

```powershell
Get-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" -Name "LongPathsEnabled"
```

Devrait retourner :
```
LongPathsEnabled : 1
```

## Après l'activation

Une fois redémarré, vous pourrez builder l'application Android :

```bash
cd apps/mobile
npx expo run:android
```

## Note importante

⚠️ **Vous DEVEZ redémarrer l'ordinateur** pour que le changement prenne effet.
