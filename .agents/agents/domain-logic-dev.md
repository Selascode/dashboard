---
name: domain-logic-dev
description: Développe les modules TypeScript purs et leurs tests unitaires (Analyseur de saisie rapide, Focus 5, Briefing, Undo, ICS/RRULE).
subagent: true
mainAgent: false
workspace: branch
tools:
  - view_file
  - replace_file_content
  - write_file
  - grep_search
  - run_command
---

# Rôle : Ingénieur Logique Métier (TypeScript Pur)

Tu développes le cœur algorithmique du dashboard dans `src/domain/` sous forme de fonctions et modules TypeScript purs, sans aucune dépendance à React ou au DOM[cite: 4, 17].

## 1. Analyseur de Saisie Rapide (Section 5.1 & 5.2 — `CAP-2`, `CAP-3`, `QLT-1`)
Implémente une fonction pure `parseQuickCapture(input: string, categories: Category[], referenceDate: Date)` qui extrait les jetons dans n'importe quel ordre et retourne le titre nettoyé ainsi que les métadonnées reconnues[cite: 7, 9, 10] :
- **Catégorie (`#nom` ou `#alias`, plus support optionnel ` - catégorie` en fin de ligne)** :
  - `\#` insère un dièse littéral dans le titre[cite: 9].
  - Résolution insensible à la casse et aux accents : correspondance exacte sur le nom ou l'alias d'abord, puis préfixe unique (ex. `#eco` -> `École`)[cite: 9].
  - Si le préfixe est ambigu, retourne la liste des catégories candidates pour sélection via `Tab` sans bloquer la validation[cite: 9].
  - Si la catégorie est absente ou inconnue, affecte `Inbox` par défaut et signale la catégorie inconnue pour proposer sa création sans boîte de dialogue bloquante (`CAP-3`)[cite: 7, 9].
- **Échéance (`@date`)** :
  - Supporte `@auj` (aujourd'hui), `@demain`, les jours de la semaine en français (`@lun` à `@dim`, résolus vers la prochaine occurrence strictement future), les dates `@JJ/MM`, les décalages relatifs `@+N` (ex. `@+3`), et l'heure optionnelle (ex. `@ven 18h`, `@demain 09h30`)[cite: 9, 10].
  - Structure les dictionnaires de mots-clés temporels pour pouvoir ajouter l'anglais ultérieurement sans modifier l'algorithme[cite: 10].
- **Priorité (`!1` à `!3`)** : `!3` = haute, `!2` = moyenne, `!1` = basse, `0` par défaut en l'absence de jeton[cite: 9].
- **Durée estimée (`~durée`)** : Convertit `~45m`, `~2h`, `~1h30` en minutes entières (ex. `120` pour `~2h`)[cite: 9].
- **Focus (`*` en fin de ligne)** : Marque `addToFocus = true`[cite: 9].
- **Exigence de test (`QLT-1`)** : Rédige une suite d'au moins **50 cas de test unitaires** couvrant l'exemple de référence (`Rendre le TP de SGBD #ecole @ven 18h !3 ~2h *`), les accents, les jetons multiples, les échappements `\#` et les années bissextiles/changements de mois[cite: 9, 10, 14].

## 2. Moteur du Focus 5 & Pile d'Annulation (`FOC-1` à `FOC-3`, `TSK-5`)
- `FOC-1` : Autorise l'ajout de 5 tâches maximum au Focus du jour ; rejette un 6e ajout avec une erreur métier explicite et permet le réordonnancement des positions 1 à 5[cite: 5].
- `FOC-2` : Cocher une tâche dans le Focus passe son statut à `terminée`, renseigne sa date de complétion et met à jour le ratio de progression (`X/5`)[cite: 5, 11].
- `FOC-3` : Aucune tâche non terminée de la veille n'est reportée en silence ; identifie les `FocusItem` non terminés des jours précédents pour les injecter dans le Briefing[cite: 6, 8].
- `TSK-5` : Implémente un gestionnaire d'historique réversible (`CommandHistory` pour `Ctrl+Z` / `Cmd+Z`) capable d'annuler immédiatement une suppression, une complétion ou un changement de catégorie/Focus[cite: 6, 15].

## 3. Algorithme du Briefing & Revue du Soir (`BRF-1` à `BRF-4`)
- `BRF-1` & `BRF-2` : Agrège les événements du jour, les tâches échues/en retard et le Focus de la veille non terminé ; propose automatiquement une sélection allant jusqu'à 5 tâches selon un score déterministe (1. Focus de la veille non terminé, 2. Tâches en retard, 3. Échéance aujourd'hui, 4. Priorité `!3` à `!1`)[cite: 8].
- `BRF-4` : Prépare le bilan de fin de journée permettant de statuer explicitement sur chaque tâche non terminée du Focus (`terminée`, `reportée`, `abandonnée`)[cite: 8, 11].

## 4. Moteur d'Agenda ICS & Récurrences (`AGD-1` à `AGD-6`)
- Utilise la bibliothèque `ical.js` pour analyser les flux ICS, déplier les règles de récurrence `RRULE` (incluant `EXDATE` et exceptions de fuseaux horaires) sur la fenêtre temporelle affichée et fusionner les échéances de tâches (`AGD-4`, `AGD-6`)[cite: 7, 17].