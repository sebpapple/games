# Grid Games

Application web Vite et PWA avec quatre jeux jouables hors ligne. L'application Android Capacitor embarque directement la sortie de production `dist/` : elle ne requiert ni backend ni connexion réseau pour démarrer ou jouer. Le site web conserve son manifeste et son service worker.

## Prérequis

- Node.js 20 ou supérieur et npm.
- Pour Android : Android Studio Otter (2025.2.1) ou supérieur, le SDK Android 36 et un JDK 21 configuré. Capacitor 8 cible Android 36 et requiert au minimum Android 7 (API 24).
- Un émulateur Android ou un appareil avec le débogage USB pour l'installation et l'exécution.

Vérifiez que `JAVA_HOME` pointe bien vers le dossier du JDK 21 et que `java -version` affiche Java 21. Un `JAVA_HOME` périmé peut empêcher Gradle de démarrer même si la commande `java` du `PATH` utilise la bonne version. Le SDK installé dans Android Studio se trouve généralement dans `%LOCALAPPDATA%\Android\Sdk` ; définissez `ANDROID_HOME` et `ANDROID_SDK_ROOT` sur ce chemin.

## Développement et PWA

```sh
npm install
npm run dev
npm test
npm run build:web
npm run preview
```

Le build web est écrit dans `dist/`. Les fichiers `public/manifest.json`, `public/sw.js` et `public/icons/` sont copiés dans ce répertoire par Vite.

## Android

`capacitor.config.json` configure Capacitor avec `webDir: "dist"`. Après toute modification web, reconstruisez et synchronisez les ressources embarquées :

```sh
npm run cap:sync
```

Commandes pratiques :

```sh
npm run android:sync
npm run android:open
npm run android:run
npm run android:debug
npm run android:release
```

`android:run` synchronise, construit et installe sur un émulateur/appareil connecté. `android:debug` produit un APK de débogage dans `android/app/build/outputs/apk/debug/app-debug.apk`, signé avec la clé debug locale et destiné aux essais. `android:release` produit un APK release signé avec la clé privée locale; il refuse de construire si les paramètres de signature requis ne sont pas définis.

### APK release signé

L'identifiant Android est `com.sebpapple.gridgames`. Il sert aux installations et aux mises à jour de cette application; gardez-le identique pour toutes les versions distribuées.

Créez une clé une seule fois, dans un emplacement **hors du dépôt**, par exemple votre dossier utilisateur. `keytool` demande le mot de passe dans le terminal :

```powershell
& "$env:ProgramFiles\Java\jdk-21.0.12.1\bin\keytool.exe" -genkeypair -v `
  -keystore "$env:USERPROFILE\grid-games-release.jks" `
  -alias gridgames -keyalg RSA -keysize 3072 -validity 10000
```

Cette commande utilise le JDK 21 installé pour le build Android, même si `keytool` n'est pas dans le `PATH`. Si le JDK 21 est installé ailleurs, remplacez son chemin par celui du dossier `bin\keytool.exe` correspondant.

Sauvegardez le fichier `.jks` et son mot de passe dans un gestionnaire de mots de passe et une sauvegarde sûre. Sans cette clé, vous ne pourrez pas signer les futures mises à jour avec la même identité. Ne l'envoyez pas dans le dépôt, dans une release GitHub, ni dans le chat.

Dans **la même fenêtre PowerShell**, définissez les paramètres de signature et lancez le build. La saisie du mot de passe est masquée; Gradle doit le recevoir comme variable d'environnement pendant la construction :

```powershell
$env:ANDROID_RELEASE_STORE_FILE = "$env:USERPROFILE\grid-games-release.jks"
$env:ANDROID_RELEASE_KEY_ALIAS = "gridgames"
$securePassword = Read-Host "Mot de passe de la clé" -AsSecureString
$env:ANDROID_RELEASE_STORE_PASSWORD = [System.Net.NetworkCredential]::new("", $securePassword).Password
$env:ANDROID_RELEASE_KEY_PASSWORD = $env:ANDROID_RELEASE_STORE_PASSWORD
npm run android:release
```

Si le mot de passe de la clé (`-keypass`) diffère du mot de passe du keystore (`-storepass`), demandez-le séparément pour `ANDROID_RELEASE_KEY_PASSWORD`. Une fois le build terminé, retirez les variables de la session :

```powershell
Remove-Item Env:ANDROID_RELEASE_STORE_FILE, Env:ANDROID_RELEASE_STORE_PASSWORD, Env:ANDROID_RELEASE_KEY_ALIAS, Env:ANDROID_RELEASE_KEY_PASSWORD
```

L'APK signé est créé dans `android/app/build/outputs/apk/release/app-release.apk`. Testez-le sur un appareil avant de le publier. Pour l'héberger sur GitHub, ouvrez le dépôt, sélectionnez **Releases > Create a new release**, choisissez un tag de version (par exemple `v1.0.0`), joignez `app-release.apk`, puis publiez la release. Ne joignez jamais le fichier `.jks`.

Les utilisateurs Android devront télécharger l'APK depuis la release et autoriser l'installation de cette application depuis leur navigateur ou gestionnaire de fichiers. Comme le dépôt est public, la release et l'APK seront accessibles à tous.

Les préférences de langue et la progression utilisent le stockage local du WebView, qui est conservé entre les démarrages. Aucun écran ne charge de ressources distantes. Sur Android, Capacitor SystemBars gère les zones de sécurité edge-to-edge; les icônes système suivent le thème clair/sombre. Le bouton Retour ferme d'abord une boîte de dialogue, revient à l'accueil depuis une partie, puis quitte depuis l'accueil.

## Validation de l'environnement

Les 38 tests Node, le build web, `npm run cap:sync` et `npm run android:debug` ont réussi. L'APK debug a été installé après désinstallation sur un émulateur Android API 37, lancé en mode avion et utilisé pour ouvrir une grille Zip et jouer un coup. Le retour Android depuis un jeu et une boîte de dialogue, ainsi que la persistance de la langue après redémarrage, ont aussi été vérifiés. Le test a nécessité de définir `JAVA_HOME` sur le JDK 21 et `ANDROID_HOME`/`ANDROID_SDK_ROOT` sur le SDK Android dans le processus de build. Le build release signé doit être exécuté localement après création de la clé privée, qui n'est pas présente dans le dépôt.

La validation a été réalisée sur émulateur, pas sur un appareil physique. L'APK release doit être testé sur un appareil avant son partage. Aucune publication sur Google Play n'est prévue pour ce mode de distribution.
