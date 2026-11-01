# Cahier des charges MVP – Dashboard de productivité

Nov 1, 2026 · @Selas

## 1. Contexte et objectifs

Le MVP est une application multiplateforme qui répond à une seule question : « que dois-je faire aujourd'hui ? », en moins de 10 secondes après l'ouverture, sans compte ni paramétrage.

**Utilisateur cible :** un seul utilisateur (toi), sur plusieurs appareils à terme. Pas de multi-utilisateurs dans le MVP.

**Problème résolu :** les tâches, l'emploi du temps et les outils du quotidien sont dispersés dans plusieurs applications. Le dashboard les rassemble dans une vue unique et filtrée.

**Principes directeurs**

- Zéro friction : des valeurs par défaut utiles, aucune configuration obligatoire.
- Clarté immédiate : jamais plus de 5 priorités à l'écran de tête.
- Clavier d'abord : toute action courante est faisable sans souris.
- Local-first : les données vivent sur l'appareil ; le cloud viendra plus tard, en option.
- Vie privée par défaut : aucun compte, aucune télémétrie, aucune donnée envoyée sans action explicite.

**Critères de réussite du MVP**

- Ajouter une tâche déjà catégorisée en moins de 5 secondes.
- Premier lancement utilisable en moins de 2 minutes, sans rien configurer.
- Ouverture à froid en moins de 2 secondes, vue du jour complète.
- Briefing du matin lisible en moins de 30 secondes.
- Aucune perte de données : une restauration depuis sauvegarde est testée et fonctionne.
- Usage quotidien réel pendant 2 semaines avant de démarrer les modules suivants (mail, agenda éditable).

## 2. Décisions d'architecture

Je recommande **Tauri 2 + React/TypeScript + SQLite** : un seul code pour Windows, macOS et Linux dès le MVP, avec le mobile en phase suivante.

### Comparatif des options pour une appli universelle

| Option | Plateformes | Accès local (appli, dossier) | Poids | Verdict |
| --- | --- | --- | --- | --- |
| Tauri 2 (Rust + interface web) | Windows, macOS, Linux ; iOS et Android (récent) | Oui, avec permissions déclarées | Quelques Mo | Recommandé |
| Electron | Windows, macOS, Linux | Oui, très mature | 100 Mo et plus | Solide mais lourd, pas de mobile |
| PWA (web installable) | Tout navigateur, mobile inclus | Non : impossible de lancer une appli ou d'ouvrir un dossier | Aucun | Insuffisant pour les outils connectés |
| Flutter | Toutes, mobile inclus | Oui, via plugins | Moyen | Bon, mais Dart et écosystème web à part |

**Pourquoi Tauri :** il répond directement au point 4. L'interface est du web (une seule base de code, réutilisable en PWA ou en application mobile), et la couche native, minimale, ouvre les fichiers, dossiers et applications sous contrôle.

**Limites à connaître :** le support mobile de Tauri 2 est plus jeune que son support desktop, et son rendu sous Linux passe par WebKitGTK, légèrement différent de Chrome. On teste donc sur les 3 systèmes dès le début. Plan B pour le mobile : la même interface en PWA ou via Capacitor.

### Intégration au système (point 4)

Trois niveaux, du plus sûr au plus risqué :

1. **Liens et schémas d'URL** : `https://`, `obsidian://`, `notion://`, `spotify:`, `mailto:`. Fonctionne sur toutes les plateformes, mobile compris. Inclus dans le MVP.
2. **Fichiers, dossiers et applications locaux** : ouverture via le plugin « opener » de Tauri, limitée aux chemins que tu ajoutes toi-même. Desktop uniquement. Inclus dans le MVP.
3. **Commandes shell arbitraires** : exclues du MVP pour des raisons de sécurité.

### Couches techniques

| Couche | Choix | Rôle |
| --- | --- | --- |
| Interface | React, TypeScript, Tailwind, bibliothèque de palette de commandes (cmdk) | Écrans, clavier, thèmes |
| Logique métier | Modules TypeScript purs, testés | Analyse de la saisie rapide, règles du Focus 5, briefing |
| Coque native | Tauri 2 (Rust) | Fenêtre, raccourci global, ouverture de fichiers, sauvegardes |
| Stockage | SQLite, migrations versionnées | Toutes les données, dans le dossier de l'appli |
| Sync (plus tard) | Couche optionnelle, désactivée par défaut | Cloud chiffré, hors MVP |

### Préparer la synchronisation sans la construire

Chaque enregistrement porte dès maintenant : un identifiant UUID, une date de création, une date de modification, une date de suppression (suppression logique) et l'identifiant de l'appareil. Ce sont les prérequis d'une synchronisation fiable ; les ajouter après coup coûte beaucoup plus cher.

## 3. Périmètre du MVP

Le MVP couvre quatre modules (tâches, agenda en lecture, outils connectés, briefing) plus le socle (commandes, sauvegarde, paramètres) ; tout le reste est reporté explicitement.

| Module | Inclus dans le MVP | Reporté |
| --- | --- | --- |
| Tâches | Focus 5, création rapide avec syntaxe, catégories, échéance, priorité, statut, vue par catégories | Dépendances, sous-tâches, récurrence, matrice d'Eisenhower, jauges de progression (V2) |
| Agenda | Lecture seule : import de fichiers ICS et abonnement à une URL ICS, vues semaine et mois, détail d'un événement | Création, modification, suppression, labels et statuts (V2) ; Google Calendar via OAuth (V3) |
| Outils connectés | Lanceur de liens, dossiers, fichiers et applications que tu définis toi-même | Suivi d'argent (V4) |
| Briefing | Écran du matin généré localement, sans notification | Notifications, résumé intelligent (V2) |
| Socle | Palette de commandes personnalisable, sauvegarde automatique, export et import, thème clair et sombre, catégories éditables | Synchronisation cloud, application mobile (V3) |
| Mail | Rien, mais une zone réservée sur le dashboard | Lecture (V3), envoi et templates (V4) |

### Hors périmètre, sans exception

- Comptes utilisateurs, partage, collaboration.
- Intelligence artificielle ou analyse de contenu.
- Télémétrie et statistiques d'usage.
- Exécution de commandes shell depuis l'application.

## 4. Fonctionnalités détaillées

Chaque exigence a un identifiant et un critère d'acceptation vérifiable. **Must** = indispensable pour livrer le MVP ; **Should** = à faire si le temps le permet, sinon reporté en V1.1.

### 4.1 Focus 5 (la boussole du jour)

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| FOC-1 | Choisir jusqu'à 5 tâches comme Focus du jour | Un 6e ajout est refusé avec un message clair ; l'ordre des 5 est modifiable | Must |
| FOC-2 | Terminer une tâche depuis le Focus | Cocher la tâche la termine ; la progression « 3/5 » se met à jour immédiatement | Must |
| FOC-3 | Gérer les tâches du Focus non terminées | Le lendemain, le briefing les propose ; aucune tâche n'est reportée en silence | Must |
| FOC-4 | Mode « Maintenant » | Une seule tâche du Focus s'affiche en grand, avec minuteur optionnel | Should |

### 4.2 Tâches et catégories

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| TSK-1 | Créer, modifier, supprimer une tâche | Le titre est le seul champ obligatoire | Must |
| TSK-2 | Champs d'une tâche | Notes, catégorie, échéance (heure facultative), priorité 0 à 3, durée estimée facultative, statut (à faire, en cours, terminée, annulée) | Must |
| TSK-3 | Catégories par défaut et éditables | 5 catégories fournies au premier lancement (Inbox, École, Sport, Perso, Projets) ; nom, couleur et alias modifiables ; supprimer une catégorie renvoie ses tâches dans Inbox | Must |
| TSK-4 | Vue liste | Filtres par catégorie, statut, échéance ; tri par échéance puis priorité | Must |
| TSK-5 | Annuler la dernière action | Ctrl+Z (Cmd+Z) annule une suppression, une complétion ou un déplacement | Must |
| TSK-6 | Vue par catégories | Cartes colorées translucides, 3 tâches prioritaires par carte ; un clic ouvre la liste complète | Should |
| TSK-7 | Mise en évidence des retards | Les tâches échues non terminées sont signalées visuellement | Should |

### 4.3 Saisie rapide

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| CAP-1 | Raccourci global de capture | Un raccourci (par défaut Ctrl+Maj+Espace, modifiable) ouvre une mini-fenêtre même si l'appli est en arrière-plan ; Entrée crée la tâche, Échap ferme | Must |
| CAP-2 | Analyse de la syntaxe | La saisie est interprétée selon la section 5 ; un aperçu en direct montre catégorie, date et priorité reconnues avant validation | Must |
| CAP-3 | Repli sans friction | Sans catégorie reconnue, la tâche va dans Inbox ; aucune boîte de dialogue bloquante | Must |

### 4.4 Agenda en lecture seule

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| AGD-1 | Ajouter une source ICS | Par fichier ou par URL ; actualisation manuelle et automatique (toutes les 30 minutes quand l'appli est ouverte, réglable) | Must |
| AGD-2 | Vues semaine et mois | Bascule en un clic ; le dashboard affiche la journée en cours | Must |
| AGD-3 | Détail d'un événement | Titre, heures, lieu et notes en lecture seule | Must |
| AGD-4 | Événements récurrents | Les règles de récurrence (RRULE) s'affichent aux bonnes dates, y compris les exceptions | Must |
| AGD-5 | Consultation hors ligne | Le dernier état de chaque source est conservé localement | Should |
| AGD-6 | Superposition des échéances | Les tâches avec échéance apparaissent dans l'agenda, distinguées des événements | Should |

### 4.5 Outils connectés (lanceur)

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| LNC-1 | Ajouter un élément | Libellé, type (lien, schéma d'URL, dossier, fichier, application), cible, icône | Must |
| LNC-2 | Ouvrir un élément | Le clic ou la commande l'ouvre via le système ; si la cible est introuvable, un message clair propose de la corriger | Must |
| LNC-3 | Organisation | Réordonnancement par glisser-déposer ; les favoris sont épinglés sur le dashboard | Must |
| LNC-4 | Sécurité des cibles | Seules les cibles ajoutées par l'utilisateur sont ouvrables ; aucun lancement de commande shell | Must |

### 4.6 Briefing du matin

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| BRF-1 | Écran de briefing quotidien | À la première ouverture du jour (ou à l'heure choisie), il affiche : date, événements du jour, tâches échues ou en retard, Focus de la veille non terminé | Must |
| BRF-2 | Composer le Focus 5 en un clic | Des tâches sont suggérées selon des règles simples (retard, échéance du jour, priorité) ; l'utilisateur valide ou ajuste | Must |
| BRF-3 | Briefing ignorable et relançable | Échap le ferme ; la commande « Briefing » le rouvre | Must |
| BRF-4 | Revue du soir | Bilan de la journée en 2 minutes, avec choix explicite du sort de chaque tâche non faite | Should |

### 4.7 Dashboard d'accueil

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| DSH-1 | Vue d'ensemble | Le Focus 5 occupe la zone principale ; autour : agenda du jour, raccourcis épinglés, prochaines échéances | Must |
| DSH-2 | Zone réservée au mail | Un emplacement est prévu dans la mise en page, masqué tant que le module mail n'existe pas | Should |
| DSH-3 | Disposition fixe | Pas de personnalisation de la mise en page dans le MVP (elle viendra en V2) | Must |

## 5. Saisie rapide et commandes

Une seule ligne de texte suffit à créer une tâche complète : le titre est ce qui reste une fois les jetons reconnus retirés.

### 5.1 Syntaxe

| Élément | Jeton | Exemples | Résultat |
| --- | --- | --- | --- |
| Catégorie | `#nom` ou alias | `#ecole`, `#eco`, `#sport` | Catégorie correspondante |
| Échéance | `@date` | `@auj`, `@demain`, `@ven`, `@15/11`, `@+3j`, `@ven 18h` | Date, et heure si fournie |
| Priorité | `!1` à `!3` | `!3` | 3 = haute ; sans jeton = 0 |
| Durée estimée | `~durée` | `~45m`, `~2h`, `~1h30` | Durée en minutes |
| Focus | `*` en fin de ligne | `*` | Ajoutée au Focus du jour s'il reste de la place |

**Exemple complet :** `Rendre le TP de SGBD #ecole @ven 18h !3 ~2h *` crée la tâche « Rendre le TP de SGBD », catégorie École, échéance le prochain vendredi à 18h, priorité 3, durée 120 minutes, ajoutée au Focus.

### 5.2 Règles de résolution

- Les jetons peuvent apparaître dans n'importe quel ordre ; `\#` insère un dièse littéral.
- Les catégories se retrouvent sans tenir compte des majuscules ni des accents : alias exact d'abord, puis préfixe unique.
- Préfixe ambigu : l'aperçu propose les choix (Tab pour choisir) sans bloquer la création.
- Catégorie inconnue : la tâche part dans Inbox et l'aperçu propose, sans bloquer, de créer la catégorie.
- Un jour de la semaine désigne sa prochaine occurrence strictement future ; `@auj` désigne aujourd'hui.
- Les mots-clés de date sont en français ; la structure permet d'ajouter l'anglais plus tard.
- L'analyse est une fonction pure, couverte par au moins 50 cas de test (accents, jetons absents, doubles jetons, dates limites).

**À propos de ton format « Tâche-Catégorie » :** le tiret apparaît dans beaucoup de titres (« Rendez-vous », « Pré-rapport »), ce qui crée des ambiguïtés. Le `#` est donc le jeton principal. Si tu tiens au tiret, on peut l'accepter en plus sous la forme `  - catégorie ` (espaces de chaque côté, en fin de ligne), avec le même résolveur.

### 5.3 Palette de commandes

La palette s'ouvre avec Ctrl+K (Cmd+K sur Mac). Elle réunit trois choses : les commandes de l'application, les éléments du lanceur (une commande « Ouvrir … » est créée automatiquement pour chacun) et la recherche de tâches (le texte tapé filtre les tâches ; Entrée ouvre celle qui est sélectionnée).

| Commande | Raccourci par défaut |
| --- | --- |
| Palette de commandes | Ctrl+K |
| Capture rapide (globale, même en arrière-plan) | Ctrl+Maj+Espace |
| Nouvelle tâche (dans l'appli) | Ctrl+N |
| Aller au dashboard, aux tâches, à l'agenda | Ctrl+1, Ctrl+2, Ctrl+3 |
| Ouvrir le briefing | Ctrl+B |
| Annuler la dernière action | Ctrl+Z |

### 5.4 Personnalisation

| ID | Exigence | Critère d'acceptation | Priorité |
| --- | --- | --- | --- |
| CMD-1 | Raccourcis modifiables | Chaque commande a un raccourci réglable ; un conflit est détecté et signalé avant enregistrement | Must |
| CMD-2 | Alias de commandes | Ajouter un nom court à une commande ou à un élément du lanceur (par exemple `obs` pour ouvrir Obsidian) | Must |
| CMD-3 | Modèles de saisie | Créer une commande qui préremplit la saisie rapide (par exemple `sport` donne « Séance de sport #sport @auj \~1h ») | Must |
| CMD-4 | Configuration exportable | Raccourcis, alias et modèles sont enregistrés dans un fichier JSON lisible, exportable et importable | Should |

## 6. Modèle de données et stockage

Toutes les données tiennent dans une base SQLite unique, stockée dans le dossier de données de l'application sur chaque système.

### Entités

| Entité | Champs principaux | Remarques |
| --- | --- | --- |
| Task | titre, notes, catégorie, statut, priorité (0 à 3), échéance, échéance avec heure (oui/non), durée estimée (minutes), date de complétion | Statuts : à faire, en cours, terminée, annulée |
| Category | nom, alias, couleur, position, catégorie système (oui/non) | Inbox est une catégorie système, non supprimable |
| FocusItem | jour, tâche, position, issue (terminée, reportée, abandonnée) | Maximum 5 par jour, imposé par la règle métier et par une contrainte en base ; une tâche apparaît une seule fois par jour |
| CalendarSource | nom, type (fichier ou URL), emplacement, fréquence d'actualisation, dernière synchro, dernière erreur | Une source en erreur n'efface jamais les événements déjà reçus |
| CalendarEvent | source, identifiant ICS, titre, début, fin, journée entière, lieu, notes, règle de récurrence, exceptions | Recréé à chaque synchro de sa source ; jamais modifié par l'utilisateur dans le MVP |
| LauncherItem | libellé, type, cible, icône, épinglé, groupe, position | Types : lien, schéma d'URL, dossier, fichier, application |
| Command | libellé, alias, action, texte de modèle, raccourci | Seules les commandes personnalisées ou modifiées sont stockées ; les commandes intégrées sont dans le code |
| Setting | clé, valeur (JSON) | Thème, heure du briefing, langue, date du dernier briefing |

**Champs communs** à toutes les entités synchronisables (tâches, catégories, focus, lanceur, commandes) : identifiant UUID, date de création, date de modification, date de suppression (suppression logique) et identifiant de l'appareil.

### Règles de stockage

- **Dates et heures :** stockées en UTC au format ISO 8601. Une échéance sans heure est une date de calendrier locale, sans fuseau, pour ne pas glisser d'un jour en changeant de fuseau.
- **Migrations :** numérotées, appliquées au démarrage, testées sur une base d'exemple ; une copie de sauvegarde est faite avant toute migration.
- **Suppression :** logique d'abord ; purge définitive des éléments supprimés depuis plus de 30 jours.
- **Accès :** une seule couche d'accès aux données ; l'interface ne manipule jamais SQL directement. C'est ce qui permettra de brancher la synchronisation plus tard.

## 7. Exigences non fonctionnelles

La vie privée et la sauvegarde sont des exigences de premier rang : une perte de données ou une fuite ferait abandonner l'outil, quelle que soit sa clarté.

### 7.1 Vie privée et sécurité

| ID | Exigence | Critère mesurable |
| --- | --- | --- |
| PRV-1 | Aucune télémétrie ni compte | Aucune requête réseau au démarrage, hors sources ICS configurées par l'utilisateur |
| PRV-2 | Ressources empaquetées | Polices, icônes et scripts sont inclus dans l'appli ; aucun CDN à l'exécution |
| PRV-3 | Secrets hors de la base | Les URL ICS privées (qui peuvent contenir un secret) sont stockées dans le trousseau du système, pas dans la base |
| PRV-4 | Permissions minimales | Liste blanche des permissions Tauri ; politique de sécurité de contenu (CSP) stricte ; aucune exécution de shell |
| PRV-5 | Chiffrement au repos | Non inclus dans le MVP : les données reposent sur le chiffrement de disque du système. Évaluer le chiffrement de la base (SQLCipher) en V2 |

### 7.2 Sauvegarde et restauration

| ID | Exigence | Critère mesurable | Priorité |
| --- | --- | --- | --- |
| BKP-1 | Sauvegarde automatique | Copie cohérente de la base (via l'API de sauvegarde de SQLite, pas une copie brute) à la fermeture et au moins une fois par jour | Must |
| BKP-2 | Rotation | 7 sauvegardes quotidiennes et 4 hebdomadaires conservées ; dossier de destination réglable (par exemple un dossier synchronisé de ton choix) | Must |
| BKP-3 | Export complet | Un fichier JSON lisible contenant toutes les données, importable sur un autre appareil | Must |
| BKP-4 | Restauration sûre | Un aperçu (nombre de tâches, dates) précède la restauration ; une copie de sécurité de l'état actuel est faite juste avant | Must |
| BKP-5 | Export chiffré | Protection par phrase secrète, avec un format standard | Should |

### 7.3 Performance, accessibilité, compatibilité, qualité

| ID | Exigence | Critère mesurable |
| --- | --- | --- |
| PRF-1 | Rapidité (objectifs) | Démarrage à froid sous 2 s ; palette ouverte sous 100 ms ; capture globale sous 300 ms |
| PRF-2 | Volume | Fluide avec 10 000 tâches et 5 000 événements |
| ACC-1 | Utilisable au clavier | Toutes les actions courantes sont accessibles sans souris ; focus toujours visible |
| ACC-2 | Lisibilité | Contraste conforme au niveau AA ; thème suivant le système ; respect de la préférence « réduire les animations » |
| CMP-1 | Systèmes pris en charge | Windows 10 et 11, macOS 12 et plus, Ubuntu 22.04 et plus ; Ubuntu et Windows testés en priorité |
| QLT-1 | Tests automatisés | Tests unitaires de l'analyseur de saisie, des règles du Focus et des migrations ; un test de bout en bout du parcours « créer, mettre au Focus, terminer » et de la restauration |
| QLT-2 | Intégration continue | La compilation et les tests tournent sur les 3 systèmes à chaque modification |
| I18N-1 | Langues | Interface en français ; textes isolés dans des fichiers de traduction pour ajouter l'anglais sans toucher au code |

## 8. Écrans et ergonomie

Le MVP compte sept écrans ; le dashboard d'accueil est le seul qui doit être parfait, puisque c'est lui que tu vois tous les jours.

| Écran | Contenu | Accès |
| --- | --- | --- |
| Dashboard | Focus 5 (zone principale), agenda du jour, raccourcis épinglés, prochaines échéances | Écran d'ouverture, Ctrl+1 |
| Tâches | Vue liste filtrable et vue par catégories (cartes colorées translucides) | Ctrl+2 |
| Agenda | Vues semaine et mois, détail d'un événement en lecture seule | Ctrl+3 |
| Briefing | Écran plein cadre du matin : événements, retards, Focus de la veille, composition du Focus | Automatique ou Ctrl+B |
| Capture rapide | Mini-fenêtre avec une seule ligne de saisie et l'aperçu de l'analyse | Raccourci global |
| Palette de commandes | Superposition : commandes, lanceur, recherche de tâches | Ctrl+K |
| Paramètres | Catégories, sources d'agenda, outils connectés, raccourcis et alias, sauvegarde, apparence | Palette ou menu |

&#91;embedded content: dashboard · 4 zones et barre latérale\]

Le Focus 5 prend la moitié gauche ; l'agenda du jour et les échéances occupent la colonne de droite, les raccourcis épinglés la bande du bas. L'emplacement du mail est réservé, mais masqué tant que le module n'existe pas.

### Principes d'ergonomie

- **Hiérarchie nette :** le Focus 5 est la zone la plus grande et la seule à porter une couleur d'accent forte. Pas plus de trois zones secondaires.
- **États vides utiles :** un Focus vide affiche un bouton « Composer mon Focus », pas un écran blanc.
- **Annuler plutôt que confirmer :** les actions s'exécutent tout de suite et restent annulables, au lieu de multiplier les boîtes de dialogue.
- **Catégories lisibles :** les cartes colorées restent translucides, mais le texte garde un contraste de niveau AA sur chaque couleur.
- **Navigation minimale :** une barre latérale étroite (Dashboard, Tâches, Agenda, Paramètres) ; le mail s'y ajoutera plus tard, sans bouleverser la mise en page.
- **Un seul style d'interaction :** tout ce qui peut se faire à la souris se fait aussi au clavier, avec le même résultat.

## 9. Plan de réalisation

Le MVP se construit en 7 jalons, soit environ 10 à 14 semaines à raison de 8 à 10 heures par semaine. Cette estimation est incertaine : on la recalcule à la fin du jalon 1, quand on connaîtra ton rythme réel.

1. **J0, Fondations (1 semaine).** Dépôt, projet Tauri + React, base SQLite avec migrations, thème, navigation, intégration continue sur 3 systèmes. *Sortie :* une appli vide qui se lance sur chaque système, tests verts.
2. **J1, Cœur des tâches (2 semaines).** Modèle de données, création, modification, suppression, catégories, analyseur de saisie avec ses 50 cas de test, capture globale. *Sortie :* une tâche catégorisée se crée en moins de 5 secondes.
3. **J2, Focus 5, dashboard et sauvegarde (2 semaines).** Focus du jour, dashboard d'accueil, annulation, sauvegarde automatique et export JSON. *Sortie :* une journée complète est utilisable, et les données sont protégées avant que tu commences à t'en servir.
4. **J3, Agenda en lecture (2 semaines).** Import ICS par fichier et URL, récurrences, vues semaine et mois. *Sortie :* ton emploi du temps s'affiche à l'identique de la source.
5. **J4, Lanceur, palette et personnalisation (2 semaines).** Éléments du lanceur, palette de commandes, raccourcis, alias et modèles. *Sortie :* tout se pilote au clavier.
6. **J5, Briefing et restauration (1,5 semaine).** Briefing du matin, composition du Focus, restauration depuis sauvegarde, export chiffré. *Sortie :* une restauration testée de bout en bout.
7. **J6, Finitions et usage réel (2 semaines).** Performance, accessibilité, correction de bugs, installateurs pour chaque système, 2 semaines d'usage quotidien. *Sortie :* les critères de réussite de la section 1 sont atteints.

### Feuille de route après le MVP

| Version | Contenu | Prérequis |
| --- | --- | --- |
| V2 | Agenda éditable avec labels et statuts, récurrence et sous-tâches, dépendances, matrice d'Eisenhower, jauges de progression, notifications, disposition personnalisable | MVP utilisé au quotidien ; durées estimées renseignées |
| V3 | Lecture des mails, Google Calendar via OAuth, synchronisation cloud chiffrée, application mobile | Champs de synchronisation déjà en place (section 6) ; choix du fournisseur cloud |
| V4 | Envoi de mails et templates, mails importants proposés à l'agenda, suivi d'argent | Module mail stable ; décision sur le stockage des données financières |

## 10. Risques et questions ouvertes

Les deux risques les plus probables sont une sous-estimation du périmètre et un raccourci global peu fiable sous Linux ; les deux se traitent dès les premiers jalons.

### Risques

| Risque | Impact | Parade |
| --- | --- | --- |
| Raccourci global limité sous Linux avec Wayland | La capture rapide perd son intérêt sur cet environnement | Tester dès J1 ; solution de repli : un raccourci défini dans le système qui lance l'appli en mode capture |
| Support mobile de Tauri encore récent | Retard ou blocage de la V3 | Garder la logique métier en TypeScript pur ; plan B en PWA ou Capacitor avec la même interface |
| Récurrences ICS (RRULE, fuseaux, exceptions) plus complexes qu'il n'y paraît | Événements affichés au mauvais jour | Utiliser une bibliothèque éprouvée (ical.js) ; tester avec tes propres calendriers réels |
| Dérive du périmètre | MVP jamais livré | Liste « hors périmètre » figée ; tout ajout en remplace un autre |
| Perte de données | Perte de confiance, abandon de l'outil | Sauvegardes dès J2, migrations testées, restauration vérifiée |
| Rendu différent selon le système (WebView2, WKWebView, WebKitGTK) | Défauts visuels sur un système | Intégration continue sur 3 systèmes, revue visuelle à chaque jalon |
| Fuite d'une URL de calendrier privée | Accès à ton agenda | Stockage dans le trousseau du système, jamais dans la base ni dans les sauvegardes |
| Outil peu utilisé après sa construction | Effort perdu | 2 semaines d'usage réel en J6 avant d'ajouter des modules |

### Questions à trancher

- **Jeton de catégorie :** le `#` seul te convient-il, ou veux-tu aussi le format avec tiret (section 5.2) ?
- **Catégories par défaut :** Inbox, École, Sport, Perso, Projets, est-ce la bonne base ?
- **Source d'agenda principale :** ton emploi du temps et ton agenda personnel offrent-ils une URL ICS ? Cela conditionne l'exigence AGD-1.
- **Briefing :** à la première ouverture du jour, ou à une heure fixe ?
- **Environnement Linux :** Ubuntu sous Wayland ou sous X11 ? Cela décide du traitement de la capture globale.
- **Mobile :** lecture seule suffit-elle en V3, ou faut-il aussi la capture de tâches depuis le téléphone ?
