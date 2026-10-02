# Hydra

Chat multi-modèles self-hosted, dans l'esprit de Grokbot et de Muse : plusieurs têtes (Grok, Claude, GPT, Gemini, modèles locaux), une seule entité cohérente. Tu changes de modèle en plein fil, l'historique, la persona, la mémoire et les décisions suivent.

## Fonctionnalités

**Modèles**
- xAI/Grok, Anthropic/Claude, OpenAI/GPT, Google/Gemini, et tout endpoint compatible OpenAI (Ollama, LM Studio, vLLM).
- Changement de modèle en plein milieu d'une conversation, streaming + raisonnement.
- Régénération de la dernière réponse avec un autre modèle.

**Cohérence inter-modèles**
- Historique unique en SQLite partagé par tous les providers.
- Persona commune, résumé roulant, provenance des tours précédents.
- Règles système interdisant les « en tant que modèle X » et les ruptures de ton.

**Mémoire**
- Mémoire globale + mémoire par conversation, extraite automatiquement, visible et éditable.
- Les fils parallèles partagent la mémoire de la conversation racine.

**Personas**
- Presets (Hydra, Ingénieur, Analyste, Plume, Compagnon, Conteur, Coach, Zen, Tuteur, Avocat du diable) + personas personnalisés.
- Chaque persona a ses instructions, son modèle préféré, sa voix, sa vitesse et sa langue.

**Voix**
- TTS xAI natif (voix intégrées et custom, vitesse 0.7–1.5×, langue, balises expressives) avec repli OpenAI.
- STT pour la dictée.
- Clonage de voix via xAI à partir d'un extrait de référence.
- Lecture automatique optionnelle des réponses, voix par persona.

**Outils et artefacts**
- Recherche web (Tavily), génération d'images.
- Création d'artefacts (Markdown, HTML, CSV, texte), podcasts audio générés en TTS.
- Rappels persistants (création par le chat ou à la main) et bibliothèque de tous les fichiers générés/uploadés.

**Conversation**
- Fils parallèles (side chats) rattachés à une conversation, avec mémoire partagée.
- File de messages : tu peux envoyer pendant qu'Hydra répond, les messages sont traités à la suite.
- Réponse à un message, réactions, recherche dans les messages.
- Upload de fichiers, vision, PDF, texte, Markdown.
- Aperçu des artefacts HTML.

**Travail des bots (Grok Bot / Muse)**
- Compétences réutilisables, invoquées avec `/raccourci`.
- Routines planifiées par bot, avec historique d’exécution. L’onglet ouvert appelle `POST /api/routines/tick` chaque minute. Un cron peut appeler la même route quand l’app est fermée.
- Ordinateur partagé (`HYDRA_WORKSPACE_DIR`) : lecture, écriture, suppression, commande shell. L’écriture, la suppression, le shell, l’oubli, la réécriture d’un artefact et le relais vers un autre bot attendent une approbation. Le shell tourne avec l’utilisateur du serveur. N’expose pas le port si la machine n’est pas à toi.
- Approbations pour les actions sensibles, règles d’auto-revue (exiger l’emporte sur autoriser).
- Relais d’une tâche vers un autre bot.
- Oubli ciblé de la mémoire, après approbation.
- Rappels dus déposés dans la conversation.
- Duplication d’un bot (profil seulement) et export de sa fiche.
- Journal d’activité dans le fil.

## Démarrage rapide (Docker)

```bash
cp .env.example .env   # remplis au moins une clé de provider
docker compose up -d --build
```

L'app écoute sur http://localhost:3000. Les données (SQLite + uploads) vivent dans le volume `hydra-data` monté sur `/data`.

## Cloudflare

Le même conteneur part sur Cloudflare Containers. Le Worker `cloudflare/hydra.ts` envoie tout le trafic vers une seule instance, pour que les utilisateurs partagent le fichier SQLite.

Containers exige le plan Workers Paid. Un compte gratuit ou temporaire reçoit un 403 sur `/containers/me` après la construction de l'image.

```bash
npx wrangler login
npx wrangler secret put XAI_API_KEY
npx wrangler deploy --containers-rollout=immediate
```

Une clé de provider suffit. Les secrets du Worker sont injectés au démarrage du conteneur, ils ne sont pas dans l'image.

Les conversations restent sur le disque du conteneur. Un snapshot est pris toutes les 10 minutes, et il ne se restaure que sur l'image qui l'a créé. Un nouveau déploiement change l'image, donc les fils et les uploads repartent de zéro. L'instance s'endort après 6 heures sans requête.

## Démarrage local

```bash
cp .env.example .env
npm install
npm run dev
```

Base par défaut : `./data/hydra.db`, uploads dans `./data/uploads`.

## Configuration

Toutes les variables sont documentées dans `.env.example`. L'essentiel :

| Variable | Rôle |
| --- | --- |
| `XAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY` | providers ; un seul suffit |
| `LOCAL_BASE_URL`, `LOCAL_MODELS` | modèles locaux compatibles OpenAI |
| `DEFAULT_MODEL`, `UTILITY_MODEL` | modèle principal et modèle utilitaire (titres, résumés, mémoire) |
| `TAVILY_API_KEY` | recherche web |
| `IMAGE_MODEL` | génération d'images |
| `SPEECH_VOICE`, `OPENAI_SPEECH_MODEL`, `OPENAI_TRANSCRIPTION_MODEL` | voix |
| `HYDRA_DB_PATH`, `HYDRA_UPLOAD_DIR` | stockage |

Les clés restent côté serveur : aucune n'est exposée au navigateur.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind · AI SDK · better-sqlite3.
