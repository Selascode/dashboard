# Suivi d'Avancement MVP — Dashboard de Productivité

> **Règle pour les Agents Antigravity :** Mettre à jour ce fichier à chaque Pull Request validée par `@qa-spec-verifier` en cochant `[x]` l'exigence et en ajoutant le nom de la branche ou le numéro de PR correspondant. Ne jamais implémenter d'éléments de la liste « Hors Périmètre ».

---

## Critères Globaux de Réussite du MVP (Section 1)
- [ ] Ajouter une tâche déjà catégorisée en moins de **5 secondes**
- [ ] Premier lancement utilisable en moins de **2 minutes**, sans rien configurer
- [ ] Ouverture à froid en moins de **2 secondes**, vue du jour complète (`PRF-1`)
- [ ] Briefing du matin lisible en moins de **30 secondes**
- [ ] Aucune perte de données : restauration depuis sauvegarde testée et fonctionnelle (`BKP-4`, `QLT-1`)
- [ ] Usage quotidien réel pendant **2 semaines** avant tout module V2/V3/V4

---

## Progression par Jalons (Section 9)

### Jalon J0 — Fondations (1 semaine)
**Objectif de sortie :** Une appli vide qui se lance sur Windows, macOS et Ubuntu, tests verts.
- [x] Initialisation du dépôt Git + structure multi-agents (`.agents/`) (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Socle Tauri 2 (Rust) + React / TypeScript + Tailwind CSS + `cmdk` (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Base SQLite unique dans le dossier de données de l'appli + système de migrations numérotées avec sauvegarde préalable (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Champs de synchronisation sur toutes les entités synchronisables (`id` UUID, `created_at`, `updated_at`, `deleted_at`, `device_id`) (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Purge automatique au démarrage des éléments supprimés logiquement depuis > 30 jours (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Navigation latérale fixe (`Dashboard`, `Tâches`, `Agenda`, `Réglages` + zone `Mail` masquée) (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Gestion des thèmes Clair / Sombre / Système (`Setting`) (`j0-foundations/prv-1-qlt-2-socle-initial`)
- [x] Pipeline CI GitHub Actions compilant et testant sur Ubuntu 22.04+, Windows 10/11 et macOS 12+ (`CMP-1`, `QLT-2`) (`j0-foundations/prv-1-qlt-2-socle-initial`)

### Jalon Transverse UI — Design System, Coque Clavier & Refonte Dashboard / Tâches (`feat/ui-design-system`)
**Objectif de sortie :** Design system à palettes dynamiques AA, zéro flash au chargement, navigation 100 % clavier et écrans Dashboard et Tâches fidèles aux maquettes.
- [x] Migration SQLite `002_ui_design_system.sql` (`theme`, `active_palette`, `custom_palettes`, `user_name` vide par défaut) et opérations CRUD `Setting`, `Category`, `Task`, `FocusItem` avec tests Rust et TypeScript (`feat/ui-design-system`)
- [x] Moteur de tokens et fonction pure de dérivation de palette (`src/design-system/tokens.ts`) : reproduction exacte de la palette Coolors Classic, garantie automatique de contraste WCAG AA (`>= 4.5:1`) dans la même teinte et dérivation des 8 couleurs de catégories (`--cat-1` à `--cat-8`) (`feat/ui-design-system`)
- [x] Zéro flash de thème au chargement (script synchrone dans `index.html` + `localStorage`) et polices bundlées localement `@fontsource/plus-jakarta-sans` & `@fontsource/inter` (`PRV-2`, `ACC-2`) (`feat/ui-design-system`)
- [x] Adaptateur de données factice en mémoire / `localStorage` pour le mode navigateur et script hors production `npm run seed:demo` / `npm run seed:reset` (`feat/ui-design-system`)
- [x] Registre unique de commandes (`src/lib/commands.ts`), raccourcis clavier (`Ctrl+1` à `4`, `Ctrl+K`, `Ctrl+B`, `Ctrl+N`, `N`, `Ctrl+Z`, `?`, `Échap`), palette `cmdk`, modale d'aide `?` et écrans « Bientôt » pour Agenda, Briefing et Paramètres (`ACC-1`, `CMD-1`) (`feat/ui-design-system`)
- [x] Refonte du Dashboard fidèle à `docs/ui-reference.png` avec contraste des bordures renforcé (`--border-subtle`, `.focus-card-surface`, `.focus-pill-control`) (`DSH-1`, `DSH-2`, `DSH-3`, `FOC-1`, `FOC-2`, `FOC-4`) (`feat/ui-design-system`)
- [x] Refonte de l'écran Tâches fidèle à `docs/ui-tasks-reference.png` en remplaçant le panneau d'import d'image hors périmètre par le panneau de rappel de syntaxe / modèles (`CMD-3`) et le panneau de détail / édition (`TSK-1` à `TSK-7`, `CAP-2`) (`feat/ui-design-system`)
- [x] Test automatisé vérifiant l'absence totale d'appel réseau (`fetch`/`XMLHttpRequest`) et de CDN externe sur le build de production (`src/__tests__/prod-no-network.test.tsx`) (`PRV-1`, `PRV-2`) (`feat/ui-design-system`)
- [x] Analyseur de saisie rapide complet (`CAP-2`, 61 tests unitaires `QLT-1`), capture globale `Ctrl+Maj+Espace` (`CAP-1`) avec repli CLI `--quick-capture`, support clavier AZERTY/Numpad (`e.code`), panneau droit repliable Option B persisté dans SQLite, troncature `line-clamp-1` avec dépliage et format de date `DD-MM-YYYY` par défaut (`feat/ui-design-system`)

### Jalon J1 — Cœur des Tâches & Saisie Rapide (2 semaines)
**Objectif de sortie :** Une tâche catégorisée se crée en moins de 5 secondes.
- [x] `TSK-1` **[Must]** : Créer, modifier, supprimer une tâche (seul le titre est obligatoire) (`feat/ui-design-system`)
- [x] `TSK-2` **[Must]** : Champs complets (`notes`, `catégorie`, `échéance` avec/sans heure, `priorité` 0 à 3, `durée estimée`, `statut` : à faire, en cours, terminée, annulée) (`feat/ui-design-system`)
- [x] `TSK-3` **[Must]** : 5 catégories par défaut (`Inbox` système non supprimable, `École`, `Sport`, `Perso`, `Projets`) ; suppression renvoyant les tâches dans `Inbox` (`feat/ui-design-system`)
- [x] `TSK-4` **[Must]** : Vue liste avec filtres (catégorie, statut, échéance) et tri (échéance puis priorité) (`feat/ui-design-system`)
- [x] `TSK-6` **[Should]** : Vue par catégories (cartes colorées translucides avec contraste AA, top 3 tâches prioritaires, clic pour liste complète) (`feat/ui-design-system`)
- [x] `TSK-7` **[Should]** : Mise en évidence visuelle des tâches échues non terminées (`feat/ui-design-system`)
- [x] `CAP-1` **[Must]** : Raccourci global de capture (`Ctrl+Maj+Espace` par défaut) ouvrant la mini-fenêtre en < 300 ms (`Entrée` crée, `Échap` ferme) + repli CLI sous Wayland (`feat/ui-design-system`)
- [x] `CAP-2` **[Must]** : Analyseur de syntaxe (`#catégorie`, `@date`, `!1`–`!3`, `~durée`, `*`, échappement `\#`) avec aperçu en direct + **50+ tests unitaires** (`QLT-1`) (`feat/ui-design-system`)
- [x] `CAP-3` **[Must]** : Repli sans friction vers `Inbox` si catégorie absente/inconnue, aucune boîte de dialogue bloquante (`feat/ui-design-system`)

### Jalon J2 — Focus 5, Dashboard & Sauvegarde (2 semaines)
**Objectif de sortie :** Une journée complète est utilisable et les données sont protégées.
- [x] `FOC-1` **[Must]** : Sélectionner jusqu'à 5 tâches dans le Focus du jour (6e refusé avec message clair, ordre 1–5 modifiable, contrainte en base) (`feat/ui-design-system`)
- [x] `FOC-2` **[Must]** : Cocher une tâche depuis le Focus la termine et met à jour immédiatement la progression (`3/5`) (`feat/ui-design-system`)
- [ ] `FOC-3` **[Must]** : Gestion des tâches du Focus non terminées la veille (aucun report silencieux, proposées au briefing suivant)
- [x] `FOC-4` **[Should]** : Mode « Maintenant » (affichage en grand d'une seule tâche du Focus avec minuteur optionnel) (`feat/ui-design-system`)
- [x] `TSK-5` **[Must]** : Annuler la dernière action avec `Ctrl+Z` / `Cmd+Z` (suppression, complétion, déplacement) (`feat/ui-design-system`)
- [x] `DSH-1` **[Must]** : Vue d'ensemble du Dashboard (Focus 5 en zone principale gauche, agenda du jour et prochaines échéances à droite, raccourcis épinglés en bas) (`feat/ui-design-system`)
- [x] `DSH-2` **[Should]** : Emplacement réservé au mail dans la mise en page, masqué par défaut (`feat/ui-design-system`)
- [x] `DSH-3` **[Must]** : Disposition fixe (aucune personnalisation du layout dans le MVP) (`feat/ui-design-system`)
- [ ] `BKP-1` **[Must]** : Sauvegarde automatique cohérente via l'API de backup SQLite à la fermeture et au moins 1 fois/jour
- [ ] `BKP-2` **[Must]** : Rotation conservant 7 sauvegardes quotidiennes et 4 hebdomadaires dans un dossier réglable
- [ ] `BKP-3` **[Must]** : Export complet des données dans un fichier JSON lisible et importable

### Jalon J3 — Agenda en Lecture Seule (2 semaines)
**Objectif de sortie :** L'emploi du temps s'affiche à l'identique de la source ICS.
- [ ] `AGD-1` **[Must]** : Ajout d'une source ICS par fichier ou URL ; actualisation manuelle et auto (toutes les 30 min par défaut)
- [ ] `AGD-2` **[Must]** : Bascule en un clic entre vues Semaine et Mois ; affichage de la journée en cours sur le Dashboard
- [ ] `AGD-3` **[Must]** : Détail d'un événement en lecture seule (titre, heures, lieu, notes)
- [ ] `AGD-4` **[Must]** : Prise en charge des règles de récurrence (`RRULE`) et exceptions via `ical.js`
- [ ] `AGD-5` **[Should]** : Consultation hors ligne (conservation du dernier état valide en cas d'erreur de synchro)
- [ ] `AGD-6` **[Should]** : Superposition distincte des échéances de tâches dans l'agenda
- [ ] `PRV-3` **[Must]** : Stockage des URL ICS privées dans le trousseau du système (jamais en base ni dans les sauvegardes en clair)

### Jalon J4 — Lanceur, Palette & Personnalisation (2 semaines)
**Objectif de sortie :** Toute l'application se pilote intégralement au clavier.
- [ ] `LNC-1` **[Must]** : Ajouter un élément au lanceur (libellé, type : lien / schéma d'URL / dossier / fichier / application, cible, icône)
- [ ] `LNC-2` **[Must]** : Ouverture via le plugin `opener` Tauri ; message clair de correction si la cible est introuvable
- [ ] `LNC-3` **[Must]** : Réordonnancement par glisser-déposer et épinglage des favoris sur le Dashboard
- [ ] `LNC-4` **[Must]** : Sécurité stricte des cibles (uniquement celles définies par l'utilisateur, zéro exécution de commande shell)
- [x] Palette de commandes `Ctrl+K` (`cmdk`) : commandes de l'appli, ouverture du lanceur et recherche de tâches (< 100 ms `PRF-1`) (`feat/ui-design-system`)
- [ ] `CMD-1` **[Must]** : Raccourcis clavier modifiables avec détection de conflits avant enregistrement
- [ ] `CMD-2` **[Must]** : Alias courts sur les commandes et éléments du lanceur (ex. `obs` pour Obsidian)
- [x] `CMD-3` **[Must]** : Modèles de saisie préremplissant la capture rapide (ex. `sport` -> `Séance de sport #sport @auj ~1h`) (`feat/ui-design-system`)
- [ ] `CMD-4` **[Should]** : Export et import JSON de la configuration des raccourcis, alias et modèles

### Jalon J5 — Briefing & Restauration (1,5 semaine)
**Objectif de sortie :** Restauration testée de bout en bout et rituel quotidien complet.
- [ ] `BRF-1` **[Must]** : Écran de briefing quotidien à la 1re ouverture du jour (ou heure choisie) : date, événements, retards, Focus de la veille non terminé
- [ ] `BRF-2` **[Must]** : Suggestion automatique et validation/ajustement du Focus 5 en un clic
- [x] `BRF-3` **[Must]** : Briefing fermable via `Échap` et relançable à tout moment via `Ctrl+B` ou la commande « Briefing » (`feat/ui-design-system`)
- [ ] `BRF-4` **[Should]** : Revue du soir en 2 minutes avec choix explicite du sort des tâches non terminées (`terminée`, `reportée`, `abandonnée`)
- [ ] `BKP-4` **[Must]** : Restauration sûre précédée d'un aperçu (nombre de tâches, dates) et d'une sauvegarde automatique de l'état actuel
- [ ] `BKP-5` **[Should]** : Export chiffré protégé par phrase secrète selon un format standard

### Jalon J6 — Finitions, Qualité & Usage Réel (2 semaines)
**Objectif de sortie :** Tous les critères de la section 1 sont validés en conditions réelles.
- [x] `PRV-1` **[Must]** : Vérification zéro télémétrie, zéro compte, zéro requête réseau au démarrage (hors sources ICS) (`feat/ui-design-system`)
- [x] `PRV-2` **[Must]** : Polices, icônes et scripts 100 % empaquetés en local (aucun CDN) (`feat/ui-design-system`)
- [x] `PRV-4` **[Must]** : Liste blanche des permissions Tauri et CSP stricte vérifiées (`feat/ui-design-system`)
- [ ] `PRF-1` **[Must]** : Validation des temps de réponse (démarrage à froid < 2 s, palette < 100 ms, capture globale < 300 ms)
- [ ] `PRF-2` **[Must]** : Test de charge fluide avec 10 000 tâches et 5 000 événements en base
- [x] `ACC-1` **[Must]** : Audit 100 % clavier sans souris avec anneau de focus toujours visible (`feat/ui-design-system`)
- [x] `ACC-2` **[Must]** : Contraste niveau AA validé, thème système et respect de `prefers-reduced-motion` (`feat/ui-design-system`)
- [x] `I18N-1` **[Must]** : Isolation complète des chaînes en français dans les fichiers de traduction (`feat/ui-design-system`)
- [ ] `QLT-1` **[Must]** : Validation finale des tests unitaires (analyseur, Focus, migrations) et des 2 tests E2E (« créer -> Focus -> terminer » et restauration)
- [ ] Génération des installateurs natifs (`.deb`/`.AppImage`, `.msi`/`.exe`, `.dmg`) et période de 2 semaines d'usage réel
