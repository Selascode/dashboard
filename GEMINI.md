# Orchestration Principale — Dashboard de Productivité (MVP)

Modèle Orchestrateur : `gemini-4-argon`
Source de vérité unique : `docs/cahier-des-charges-mvp.md`

## 1. Mission et Principes Directeurs Inviolables
Le MVP répond à une seule question : « Que dois-je faire aujourd'hui ? » en moins de 10 secondes après l'ouverture, sans compte ni paramétrage obligatoire.
- **Zéro friction** : Valeurs par défaut immédiates, premier lancement utilisable en moins de 2 minutes[cite: 2].
- **Clarté immédiate** : Maximum 5 priorités (Focus 5) sur l'écran de tête[cite: 2, 5].
- **Clavier d'abord** : 100 % des actions courantes réalisables sans souris (`ACC-1`)[cite: 2, 14, 16].
- **Local-first & Vie privée par défaut** : Aucune télémétrie, aucun compte, aucun appel réseau au démarrage hors sources ICS configurées par l'utilisateur (`PRV-1`), aucune ressource chargée depuis un CDN externe (`PRV-2`)[cite: 2, 12].

## 2. Garde-Fous "Hors Périmètre" (Rejet Automatique)
En tant qu'agent principal, tu dois REFUSER d'implémenter dans le MVP :
- Comptes utilisateurs, partage ou collaboration[cite: 5].
- Intelligence artificielle ou analyse automatique de contenu[cite: 5].
- Télémétrie ou statistiques d'usage[cite: 5, 12].
- Exécution de commandes shell arbitraires depuis l'application (`PRV-4`, `LNC-4`)[cite: 3, 5, 8, 13].
- Fonctionnalités reportées aux V2/V3/V4 : dépendances entre tâches, sous-tâches, matrice d'Eisenhower, jauges de progression par projet, édition d'agenda, OAuth Google Calendar, suivi d'argent, lecture/envoi de mails (seul l'emplacement masqué `DSH-2` est prévu)[cite: 4, 5, 9, 16, 17].

## 3. Règles Architecturales Transverses
- **Stack stricte** : Tauri 2 (Rust) + React / TypeScript + Tailwind CSS + `cmdk` + SQLite[cite: 2, 4].
- **Séparation des couches** : L'interface React ne manipule jamais de SQL directement et passe exclusivement par une couche d'accès aux données unique[cite: 12]. La logique métier (saisie rapide, règles Focus 5, briefing) réside dans des modules TypeScript purs et testés indépendamment[cite: 4].
- **Préparation à la synchronisation future** : Toutes les entités synchronisables (`Task`, `Category`, `FocusItem`, `LauncherItem`, `Command`) DOIVENT comporter dès le MVP : `id` (UUID), `created_at` (UTC ISO 8601), `updated_at` (UTC ISO 8601), `deleted_at` (suppression logique) et `device_id`[cite: 4, 12].

## 4. Plan de Réalisation par Jalons (J0 à J6)
Organise systématiquement le développement selon les 7 jalons officiels :
- **J0 — Fondations** : Dépôt, Tauri 2 + React, SQLite + migrations numérotées, thème clair/sombre, navigation latérale, CI sur Windows, macOS et Ubuntu.
- **J1 — Cœur des tâches** : Entités `Task` et `Category` (5 catégories par défaut : Inbox, École, Sport, Perso, Projets), CRUD (`TSK-1` à `TSK-4`, `TSK-6`, `TSK-7`), analyseur de saisie rapide avec >= 50 tests unitaires (`CAP-2`, `QLT-1`), capture globale `Ctrl+Maj+Espace` (`CAP-1`, `CAP-3`)[cite: 6, 7, 10, 14, 16].
- **J2 — Focus 5, Dashboard & Sauvegarde** : Règles `FOC-1` à `FOC-4`, layout fixe du Dashboard 4 zones (`DSH-1` à `DSH-3`), annulation `Ctrl+Z` (`TSK-5`), backup SQLite auto + rotation 7j/4sem + export JSON (`BKP-1` à `BKP-3`)[cite: 5, 6, 8, 9, 13, 15, 16].
- **J3 — Agenda en lecture seule** : Import fichier/URL ICS avec secrets dans le trousseau système (`PRV-3`), parsing `ical.js` et `RRULE` (`AGD-1` à `AGD-6`), vues semaine/mois[cite: 7, 13, 16, 17].
- **J4 — Lanceur, Palette & Personnalisation** : `LauncherItem` via plugin `opener` Tauri (`LNC-1` à `LNC-4`), palette `cmdk` `Ctrl+K`, raccourcis/alias/modèles de saisie et export config JSON (`CMD-1` à `CMD-4`)[cite: 3, 4, 8, 10, 11, 16].
- **J5 — Briefing & Restauration** : Écran de briefing matinal et revue du soir (`BRF-1` à `BRF-4`), restauration sûre avec aperçu et backup préalable (`BKP-4`), export chiffré par phrase secrète (`BKP-5`)[cite: 8, 13, 16].
- **J6 — Finitions & Usage réel** : Optimisation des performances (`PRF-1`, `PRF-2`), accessibilité clavier/AA (`ACC-1`, `ACC-2`), installeurs multi-OS[cite: 13, 14, 16].

## 5. Protocole d'Exécution et Délégation aux Sous-Agents
Ne code jamais directement sur la branche `main`. Pour chaque tâche ou exigence demandée :
1. **Identification** : Identifie le jalon (`J0`–`J6`) et les identifiants d'exigences exacts (ex. `FOC-1`, `CAP-2`, `BKP-1`) dans `docs/cahier-des-charges-mvp.md`[cite: 5, 7, 13, 16].
2. **Délégation ciblée (`invoke_subagent`)** :
   - Appelle `@core-tauri-sqlite` pour tout ce qui touche à Rust, Tauri, SQLite, migrations, sauvegardes, trousseau système ou raccourcis globaux OS[cite: 4, 7, 11, 12, 13].
   - Appelle `@domain-logic-dev` pour les algorithmes en TypeScript pur (parser syntaxique, règles Focus 5, briefing, `ical.js`, pile Undo)[cite: 4, 5, 6, 7, 8, 9, 17].
   - Appelle `@ui-keyboard-dev` pour les composants React, Tailwind, `cmdk`, la navigation clavier et les fichiers de traduction i18n[cite: 4, 10, 14, 15].
3. **Vérification Obligatoire** : Une fois l'implémentation terminée sur la branche de travail, appelle systématiquement `@qa-spec-verifier` (et `/browser` pour le rendu UI) afin de valider chaque critère d'acceptation[cite: 5, 14].
4. **Boucle de Correction** : Si `@qa-spec-verifier` renvoie `REJECTED`, ré-invoque le sous-agent développeur concerné avec la trace d'erreur jusqu'à obtenir `APPROVED`.
5. **Publication GitHub** : Une fois le statut `APPROVED` obtenu, appelle `@git-guardian` pour pousser la branche et ouvrir la Pull Request documentée sur GitHub.