# Audit UI/UX — Hydra

Audit de `src/components/`, `src/app/page.tsx`, `src/app/layout.tsx` et `src/app/globals.css`.
Les problèmes sont classés par thème, avec une sévérité (P1 bloquant / P2 important / P3 confort).

## 1. Cohérence visuelle

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 1.1 | P2 | Couleurs codées en dur hors tokens : bandeau d'erreur en `rgba(255,107,107,…)` alors que `--danger` vaut `#ff453a` ; `chip-active` en `#4aa8ff` ; liens markdown en `#4aa8ff` ; `btn-primary:hover` en `#3b9bff` ; `select.field option` en `#1c1c1e`. | `chat-app.tsx`, `globals.css` |
| 1.2 | P2 | Rappel « échu » signalé avec un violet `rgba(124,92,255,0.6)` qui n'existe nulle part ailleurs dans la palette (reliquat d'un ancien thème). | `reminders-panel.tsx` |
| 1.3 | P3 | `--accent` et `--accent-2` ont la même valeur : token mort. | `globals.css` |
| 1.4 | P2 | Échelle typographique ad hoc : `text-[10px]`, `text-[11px]`, `text-[13px]`, `text-xs`, `text-sm`, `text-[15px]` mélangés sans règle, avec des tailles arbitraires en pixels répétées 40+ fois. | tous les composants |
| 1.5 | P2 | Les 4 panneaux latéraux réimplémentent chacun le même en-tête (`flex items-center justify-between border-b … px-4 py-3.5`) et la même coque `w-[320px] shrink-0` : duplication et dérive garantie. | `memory-panel`, `library-panel`, `reminders-panel`, `voice-panel` |
| 1.6 | P3 | Boutons d'action des rappels : `<button>` nus stylés à la main au lieu des primitives `.btn`/`.chip`. | `reminders-panel.tsx` |
| 1.7 | P3 | `.avatar` / `.avatar-user` / `.hairline` définis dans `globals.css` mais jamais utilisés. | `globals.css` |
| 1.8 | P3 | `Mascot` applique `self-start` dans sa classe de base et reçoit `self-end` par `className` : deux utilitaires de même spécificité, le résultat dépend de l'ordre de génération Tailwind. | `mascot.tsx`, `chat-app.tsx` |

## 2. États de chargement, vides et d'erreur

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 2.1 | P1 | **Aucun état de chargement dans toute l'application.** Au premier rendu, la barre latérale affiche « Aucune conversation. » et le fil affiche l'écran d'accueil « Bonjour. » — alors que les données sont encore en vol. L'utilisateur voit un état vide faux pendant toute la latence réseau. | `chat-app.tsx` |
| 2.2 | P1 | Même problème dans `library-panel` (« Rien pour le moment. ») et `reminders-panel` (« Aucun rappel. ») : l'état vide s'affiche avant la réponse de l'API. | `library-panel.tsx`, `reminders-panel.tsx` |
| 2.3 | P1 | Ouverture d'une conversation (`openConversation`) : aucun indicateur, le fil précédent reste affiché jusqu'au remplacement brutal. | `chat-app.tsx` |
| 2.4 | P1 | Les `fetch` ne vérifient pas `res.ok` (`refreshConversations`, `refreshPersonas`, library, reminders, mémoires, personas). Une 500 provoque un `JSON.parse` en échec dans une promesse non attrapée : écran figé, zéro message. | `chat-app.tsx` et tous les panneaux |
| 2.5 | P2 | Aucun état d'erreur récupérable : pas de bouton « Réessayer » nulle part. | tous les panneaux |
| 2.6 | P2 | Les états vides sont du texte gris nu, sans icône ni action. Rien n'oriente l'utilisateur (« Rien pour le moment. »). | `library-panel`, `memory-panel`, `reminders-panel`, sidebar |
| 2.7 | P2 | L'upload est totalement silencieux tant qu'il n'a pas abouti : pas de chip en cours, pas de spinner, aucun moyen d'annuler ou de retirer une pièce jointe ajoutée par erreur. | `chat-app.tsx` |
| 2.8 | P2 | La sauvegarde d'un bot (`save`) et le clonage de voix n'ont qu'un `busy` local partiellement reflété ; la sauvegarde d'un bot ne montre rien pendant la requête. | `bot-studio.tsx`, `voice-panel.tsx` |

## 3. Feedback utilisateur

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 3.1 | P1 | **Toutes les suppressions sont immédiates et irréversibles, sans confirmation ni notification** : conversation (avec tout son historique), souvenir, rappel, bot. | `chat-app.tsx`, `memory-panel.tsx`, `reminders-panel.tsx`, `bot-studio.tsx` |
| 3.2 | P2 | Aucun retour de succès : ajout de souvenir, ajout de rappel, marquage « Terminé », création/modification de bot, upload réussi — tout se fait en silence. | panneaux |
| 3.3 | P2 | Le bouton « Copier » ne donne aucun retour : impossible de savoir si la copie a marché. | `chat-app.tsx` |
| 3.4 | P2 | Les erreurs du chat sont poussées en bas de la liste des messages, non fermables, et écrasées par l'erreur suivante. Les erreurs des panneaux (échec de suppression, etc.) sont, elles, totalement perdues. | `chat-app.tsx` |
| 3.5 | P3 | `speak()` ne signale pas la lecture en cours et ne permet pas de l'arrêter ; plusieurs clics superposent les audios. | `chat-app.tsx` |
| 3.6 | P3 | Le message d'état du clonage de voix s'affiche en gris quel que soit le résultat : succès et échec sont visuellement identiques. | `voice-panel.tsx` |

## 4. Accessibilité

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 4.1 | P1 | **Aucun style `:focus-visible`.** `.field` fait même `outline: none` (le `:focus` stylé ne s'applique pas aux boutons). La navigation clavier est invisible sur toute l'app. | `globals.css` |
| 4.2 | P1 | Les boutons icône seuls (fermer, supprimer, joindre, micro, régénérer, envoyer, sidebar) n'ont qu'un `title`, pas de `aria-label` : nom accessible absent ou peu fiable selon les lecteurs d'écran. | tous les composants |
| 4.3 | P1 | `BotStudio` est une modale sans `role="dialog"`, sans `aria-modal`, sans `aria-labelledby`, sans piège de focus, sans fermeture par `Échap`, et le clic sur l'arrière-plan ne ferme pas. | `bot-studio.tsx` |
| 4.4 | P1 | Le streaming de la réponse n'est pas annoncé : pas de région `aria-live`, ni pour le texte en cours, ni pour les erreurs. | `chat-app.tsx` |
| 4.5 | P2 | Les `<select>` du header (modèle, persona) n'ont aucun label, visible ou non. | `chat-app.tsx` |
| 4.6 | P2 | Les bascules Web / Images / Fil parallèle sont des boutons à état sans `aria-pressed`. | `chat-app.tsx` |
| 4.7 | P2 | Les panneaux latéraux et la barre latérale ne sont pas des régions nommées (`aria-label`) et ne se ferment pas avec `Échap`. | tous les panneaux |
| 4.8 | P2 | Contraste : `--muted #8e8e93` sur `--surface-2 #212121` ≈ 4.3:1, sous le seuil AA pour du texte de 10–11 px, utilisé massivement pour des métadonnées. | `globals.css` |
| 4.9 | P2 | Les actions de message (Copier / Écouter) sont en `opacity-0` révélées au survol : inaccessibles au clavier puisque l'opacité ne réagit pas au focus. Idem pour la suppression de conversation et de souvenir. | `chat-app.tsx`, `memory-panel.tsx` |
| 4.10 | P2 | `préfère-reduced-motion` n'est pas respecté pour le défilement automatique (`behavior: 'smooth'`). | `chat-app.tsx` |
| 4.11 | P3 | Pas de lien d'évitement, et la liste des messages n'est pas un repère nommé. | `chat-app.tsx` |
| 4.12 | P3 | Le `<input type="file">` de clonage de voix n'a pas d'étiquette. | `voice-panel.tsx` |

## 5. Responsive / mobile

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 5.1 | P1 | **Aucun point de rupture dans l'application.** La barre latérale (`w-[264px] shrink-0`) et les panneaux (`w-[320px] shrink-0`) sont toujours en flux : sur un écran de 390 px, il reste ~ -194 px pour le chat quand un panneau est ouvert. L'app est inutilisable sur mobile. | `chat-app.tsx`, panneaux |
| 5.2 | P1 | `sidebarOpen` est initialisé à `true` inconditionnellement, sans tenir compte de la taille d'écran. | `chat-app.tsx` |
| 5.3 | P2 | Le header du chat empile 5–6 contrôles avec `flex-wrap` : sur mobile il occupe 3 lignes et mange la zone de lecture. | `chat-app.tsx` |
| 5.4 | P2 | Les bulles à `max-w-[78%]` / `max-w-[82%]` gaspillent l'espace sur mobile (marge inutile) alors que le padding du conteneur suffit. | `chat-app.tsx` |
| 5.5 | P2 | La modale `BotStudio` fait `h-full` avec `p-4` : sur mobile la grille `md:grid-cols-[260px_1fr]` retombe bien en colonne, mais la hauteur fixe et la grille de mascottes `grid-cols-6` restent serrées. | `bot-studio.tsx` |
| 5.6 | P3 | `body` est en `overflow-hidden` : sur iOS le clavier virtuel réduit la fenêtre et le composeur peut sortir du viewport (pas de `dvh`). | `layout.tsx` |

## 6. Structure des composants

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 6.1 | P2 | `chat-app.tsx` : 927 lignes, ~20 `useState`, la barre latérale, le header, la liste des messages, l'accueil, le composeur et le montage des 5 panneaux dans un seul JSX. Illisible et non testable. | `chat-app.tsx` |
| 6.2 | P2 | `bot-studio.tsx` : 494 lignes mêlant la liste, l'éditeur, l'upload d'avatar et les templates ; la carte persona est une fonction `card` interne recréée à chaque rendu. | `bot-studio.tsx` |
| 6.3 | P3 | Le rendu des pièces jointes est dupliqué à l'identique pour les messages utilisateur et assistant. | `chat-app.tsx` |
| 6.4 | P3 | Aucun composant partagé d'état (vide / chargement / erreur) : chaque panneau réinvente son texte. | tous les panneaux |

## 7. Divers

| # | Sévérité | Problème | Localisation |
|---|---|---|---|
| 7.1 | P2 | Le défilement automatique vers le bas est inconditionnel : impossible de relire un message pendant que la réponse arrive, la vue est ramenée en bas à chaque token. | `chat-app.tsx` |
| 7.2 | P2 | Le composeur ne grandit pas avec le texte (`rows={1}` + `max-h-48` sans auto-resize) : on écrit un long message dans une fenêtre d'une ligne. | `chat-app.tsx` |
| 7.3 | P3 | Les suggestions de l'écran d'accueil remplissent le brouillon mais ne donnent pas le focus au composeur. | `chat-app.tsx` |
| 7.4 | P3 | Pas de bouton « Arrêter la génération » pendant le streaming. | `chat-app.tsx` |
| 7.5 | P3 | Pas de raccourci pour démarrer une conversation ni pour fermer un panneau. | `chat-app.tsx` |

---

## Priorisation retenue

**Corrigé dans cette PR (P1 + P2 majoritaires)** : tokens et palette unifiés, `:focus-visible` global, primitives partagées (panneau latéral, états vide/chargement/erreur, toasts, confirmation), états de chargement et d'erreur pour le chat et les 4 panneaux, gestion de `res.ok` côté UI, feedback sur toutes les actions destructives et créatrices, ARIA (dialogue, live regions, labels, `aria-pressed`), fermeture par `Échap`, responsive complet (drawer + panneaux en overlay sous `md`), auto-resize du composeur, défilement intelligent, bouton d'arrêt du streaming, découpage de `chat-app.tsx`.

**Laissé de côté (documenté dans la PR)** : refonte complète de `bot-studio.tsx`, piège de focus complet (une boucle de tabulation stricte demande une dépendance ou un utilitaire dédié), file d'attente d'upload avec annulation, contrôle de lecture audio global, thème clair, raccourcis clavier globaux.
