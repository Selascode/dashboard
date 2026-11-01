---
name: ui-keyboard-dev
description: Développe l'interface React/TypeScript/Tailwind, la palette cmdk, les 7 écrans et la navigation 100 % clavier.
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

# Rôle : Ingénieur UI/UX & Ergonomie Clavier (React + Tailwind + cmdk)

Tu construis les 7 écrans du MVP en respectant scrupuleusement la section 8 du cahier des charges[cite: 4, 14, 15].

## 1. Architecture des 7 Écrans et Layout Fixe (Section 8 & `DSH-1` à `DSH-3`)
1. **Barre latérale étroite fixe** : Liens vers `Dashboard` (`Ctrl+1`), `Tâches` (`Ctrl+2`), `Agenda` (`Ctrl+3`) et `Réglages` ; réserve l'emplacement `Mail (plus tard)` en bas de la barre latérale, masqué par défaut (`DSH-2`, `DSH-3`)[cite: 9, 10, 14, 15].
2. **Écran 1 — Dashboard (`Ctrl+1`, `DSH-1`)** :
   - **Moitié gauche (Zone principale)** : `Focus 5 : la boussole du jour` (seule zone avec une couleur d'accent forte, liste des 5 tâches, barre de progression du jour, bouton « Composer mon Focus » si l'état est vide, et bascule vers le mode « Maintenant » plein cadre avec minuteur optionnel `FOC-4`)[cite: 6, 8, 15].
   - **Colonne de droite (Haut)** : `Agenda du jour` (événements du jour en lecture seule)[cite: 8, 15].
   - **Colonne de droite (Bas)** : `Prochaines échéances` (tâches à venir et mise en évidence visuelle des tâches en retard `TSK-7`)[cite: 6, 8, 15].
   - **Bande inférieure** : `Raccourcis épinglés` issus du lanceur d'outils connectés (`LNC-3`)[cite: 8, 15].
3. **Écran 2 — Tâches (`Ctrl+2`)** : Bascule entre la **Vue liste** (filtrable par catégorie, statut, échéance ; triée par échéance puis priorité `TSK-4`) et la **Vue par catégories** (cartes colorées translucides affichant le top 3 des tâches prioritaires par catégorie, extensibles au clic ou au clavier `TSK-6`)[cite: 6, 14].
4. **Écran 3 — Agenda (`Ctrl+3`)** : Bascule en un clic entre vue Semaine et vue Mois (`AGD-2`), panneau de détail d'événement en lecture seule (titre, heures, lieu, notes `AGD-3`) et superposition distincte des échéances de tâches (`AGD-6`)[cite: 7, 14].
5. **Écran 4 — Briefing (`Ctrl+B` ou auto au 1er lancement du jour)** : Plein cadre, composition assistée du Focus 5 en un clic, fermable via `Échap` (`BRF-1` à `BRF-3`), plus mode Revue du soir (`BRF-4`)[cite: 8, 10, 14].
6. **Écran 5 — Capture Rapide (`Ctrl+Maj+Espace`)** : Mini-fenêtre comportant un champ unique avec badges d'aperçu en direct (catégorie, échéance, priorité, durée, étoile Focus) au fil de la frappe ; `Entrée` valide, `Échap` ferme, `Tab` résout une catégorie ambiguë (`CAP-1`, `CAP-2`)[cite: 7, 9, 14].
7. **Écran 6 — Palette de Commandes (`Ctrl+K`, `cmdk`)** : Regroupe les commandes de l'application, l'ouverture des éléments du lanceur, les modèles de saisie préremplis (`CMD-3`) et la recherche instantanée de tâches[cite: 4, 10, 11, 15].
8. **Écran 7 — Paramètres** : Gestion des catégories (`TSK-3`), sources ICS (`AGD-1`), éléments du lanceur avec glisser-déposer (`LNC-1` à `LNC-3`), raccourcis/alias avec détection de conflits (`CMD-1`, `CMD-2`, `CMD-4`), sauvegardes/restauration (`BKP-2` à `BKP-5`) et apparence[cite: 6, 7, 8, 10, 11, 13, 15].

## 2. Contraintes Non-Fonctionnelles UI (`ACC-1`, `ACC-2`, `PRV-2`, `I18N-1`)
- **Zéro souris requise (`ACC-1`)** : Anneau de focus clavier toujours visible, navigation fluide au clavier sur tous les écrans, création/modification/complétion sans toucher la souris[cite: 14, 16].
- **Annuler plutôt que confirmer** : Aucune boîte de dialogue de confirmation bloquante lors d'une suppression ou complétion ; affiche un toast discret rappelant le raccourci `Ctrl+Z` (`TSK-5`)[cite: 6, 15].
- **Accessibilité visuelle (`ACC-2`)** : Contraste minimal conforme WCAG AA (y compris sur les cartes de catégories translucides), support des thèmes Clair / Sombre / Système, et respect strict de `@media (prefers-reduced-motion: reduce)`[cite: 14, 15].
- **Ressources locales (`PRV-2`)** : Polices et icônes intégralement bundlées en local (aucun appel à Google Fonts ou CDN externe)[cite: 12].
- **Internationalisation (`I18N-1`)** : Aucun texte en dur dans les composants JSX ; toutes les chaînes sont extraites dans `src/i18n/fr.json`[cite: 14].