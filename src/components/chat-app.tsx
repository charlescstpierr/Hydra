'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IconArrowUp,
  IconBack,
  IconBranch,
  IconClock,
  IconClip,
  IconCopy,
  IconGlobe,
  IconImage,
  IconLibrary,
  IconMemory,
  IconMic,
  IconPersona,
  IconPlus,
  IconRefresh,
  IconReminder,
  IconSidebar,
  IconSpeaker,
  IconStop,
  IconTrash,
  IconVoice,
} from '@/components/icons';
import { LibraryPanel } from '@/components/library-panel';
import { Mascot } from '@/components/mascot';
import { Markdown } from '@/components/markdown';
import { MemoryPanel } from '@/components/memory-panel';
import { BotStudio } from '@/components/bot-studio';
import { BotComputer } from '@/components/bot-computer';
import { BotRail } from '@/components/bot-rail';
import { RemindersPanel } from '@/components/reminders-panel';
import { DEFAULT_VOICE_SETTINGS, VoicePanel, type VoiceSettings } from '@/components/voice-panel';
import type { Attachment, Conversation, Memory, Message, Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import { readEventStream } from '@/lib/sse';
import type { VoiceInfo } from '@/lib/voice';
import { ErrorState, LoadingState } from '@/components/ui';

interface Capabilities {
  webSearch: boolean;
  imageGeneration: boolean;
  voice: boolean;
  voiceCloning: boolean;
}

const EMPTY_CAPS: Capabilities = {
  webSearch: false,
  imageGeneration: false,
  voice: false,
  voiceCloning: false,
};

const VOICE_SETTINGS_KEY = 'hydra.voice';

const TOOL_LABELS: Record<string, string> = {
  web_search: 'recherche web',
  create_image: 'génération d’image',
  create_artifact: 'création d’artefact',
  create_podcast: 'production audio',
  set_reminder: 'rappel programmé',
};

export function ChatApp() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities>(EMPTY_CAPS);
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [sideChats, setSideChats] = useState<Conversation[]>([]);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [voiceProvider, setVoiceProvider] = useState<string | null>(null);
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(DEFAULT_VOICE_SETTINGS);
  const [queue, setQueue] = useState<string[]>([]);

  const [modelId, setModelId] = useState('');
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Attachment[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [liveText, setLiveText] = useState('');
  const [liveReasoning, setLiveReasoning] = useState('');
  const [toolEvents, setToolEvents] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [useWeb, setUseWeb] = useState(true);
  const [useImages, setUseImages] = useState(true);
  const [panel, setPanel] = useState<
    'none' | 'memory' | 'persona' | 'voice' | 'reminders' | 'library' | 'computer'
  >('none');
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recording, setRecording] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const queueRef = useRef<string[]>([]);
  const streamingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const availableModels = useMemo(() => models.filter((m) => m.available), [models]);
  const activePersona = useMemo(
    () => personas.find((p) => p.id === conversation?.persona_id) ?? null,
    [personas, conversation],
  );

  const refreshConversations = useCallback(async () => {
    const res = await fetch('/api/conversations');
    const data = (await res.json()) as { conversations: Conversation[] };
    setConversations(data.conversations);
    return data.conversations;
  }, []);

  const refreshPersonas = useCallback(async () => {
    const res = await fetch('/api/personas');
    const data = (await res.json()) as { personas: Persona[] };
    setPersonas(data.personas);
  }, []);

  const refreshVoices = useCallback(async () => {
    const res = await fetch('/api/voices');
    if (!res.ok) return;
    const data = (await res.json()) as { provider: string | null; voices: VoiceInfo[] };
    setVoices(data.voices);
    setVoiceProvider(data.provider);
  }, []);

  const openConversation = useCallback(async (id: string) => {
    setLoadingConversation(true);
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) {
      setError('Impossible de charger cette conversation.');
      setLoadingConversation(false);
      return;
    }
    const data = (await res.json()) as {
      conversation: Conversation;
      messages: Message[];
      memories: Memory[];
      attachments: Attachment[];
      sideChats: Conversation[];
    };
    setConversation(data.conversation);
    setSelectedBotId(data.conversation.persona_id);
    setMessages(data.messages);
    setMemories(data.memories);
    setAttachments(data.attachments);
    setSideChats(data.sideChats);
    setLiveText('');
    setLiveReasoning('');
    setToolEvents([]);
    if (data.conversation.default_model) setModelId(data.conversation.default_model);
    setLoadingConversation(false);
  }, []);

  useEffect(() => {
    (async () => {
      try {
      const res = await fetch('/api/models');
      if (!res.ok) throw new Error('Impossible de charger la configuration.');
      const data = (await res.json()) as {
        models: ModelInfo[];
        defaultModel: string | null;
        capabilities: Capabilities;
      };
      setModels(data.models);
      setCapabilities(data.capabilities);
      if (data.defaultModel) setModelId((current) => current || data.defaultModel!);

      await refreshPersonas();
      if (data.capabilities.voice) await refreshVoices();
      const list = await refreshConversations();
      if (list.length > 0) await openConversation(list[0].id);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setInitializing(false);
      }
    })();
  }, [openConversation, refreshConversations, refreshPersonas, refreshVoices]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const stored = window.localStorage.getItem(VOICE_SETTINGS_KEY);
      if (stored) {
        setVoiceSettings({ ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(stored) as VoiceSettings) });
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  const updateVoiceSettings = useCallback((settings: VoiceSettings) => {
    setVoiceSettings(settings);
    window.localStorage.setItem(VOICE_SETTINGS_KEY, JSON.stringify(settings));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveText]);

  async function newConversation(options?: {
    personaId?: string | null;
    parentId?: string | null;
    usePersonaModel?: boolean;
  }) {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultModel: options?.usePersonaModel ? undefined : modelId || undefined,
        personaId: options?.personaId ?? null,
        parentId: options?.parentId ?? null,
        title: options?.parentId ? 'Fil parallèle' : undefined,
      }),
    });
    const { conversation: created } = (await res.json()) as { conversation: Conversation };
    await refreshConversations();
    setConversation(created);
    setSelectedBotId(created.persona_id);
    setMessages([]);
    setAttachments([]);
    setMemories([]);
    setPending([]);
    setSideChats([]);
    if (created.default_model) setModelId(created.default_model);
    return created;
  }

  /** Opens a fresh thread with a bot, including its greeting message. */
  async function startChatWithBot(personaId: string) {
    const created = await newConversation({ personaId, usePersonaModel: true });
    await openConversation(created.id);
    setSelectedBotId(personaId);
    if (panel !== 'computer') setPanel('none');
  }

  function selectBot(id: string) {
    if (selectedBotId === id && panel === 'computer') {
      setPanel('none');
      return;
    }
    setSelectedBotId(id);
    setPanel('computer');
  }

  async function removeConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    const list = await refreshConversations();
    if (conversation?.id === id) {
      if (list.length > 0) await openConversation(list[0].id);
      else {
        setConversation(null);
        setSelectedBotId(null);
        setMessages([]);
      }
    }
  }

  async function setConversationPersona(personaId: string | null) {
    if (!conversation) return;
    const persona = personas.find((p) => p.id === personaId);
    const res = await fetch(`/api/conversations/${conversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ personaId }),
    });
    const { conversation: updated } = (await res.json()) as { conversation: Conversation };
    setConversation(updated);
    setSelectedBotId(updated.persona_id);
    if (persona?.preferred_model) setModelId(persona.preferred_model);
  }

  async function uploadFiles(files: FileList) {
    for (const file of Array.from(files)) {
      const form = new FormData();
      form.set('file', file);
      if (conversation) form.set('conversationId', conversation.id);
      const res = await fetch('/api/upload', { method: 'POST', body: form });
      if (!res.ok) {
        setError(((await res.json()) as { error?: string }).error ?? 'Upload impossible');
        continue;
      }
      const { attachment } = (await res.json()) as { attachment: Attachment };
      setPending((current) => [...current, attachment]);
      setToast(`${file.name} ajouté`);
    }
  }

  async function run(options: { text?: string; regenerateFromSeq?: number }) {
    if (streamingRef.current) return;
    if (!modelId) {
      setError("Aucun modèle disponible : configure au moins une clé API dans le fichier .env");
      return;
    }

    let active = conversation;
    if (!active) active = await newConversation();

    const attachmentIds = pending.map((a) => a.id);
    setError(null);
    streamingRef.current = true;
    setStreaming(true);
    setLiveText('');
    setLiveReasoning('');
    setToolEvents([]);
    setDraft('');
    setPending([]);

    if (options.regenerateFromSeq !== undefined) {
      setMessages((current) => current.filter((m) => m.seq < options.regenerateFromSeq!));
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: active.id,
          modelId,
          text: options.text,
          attachmentIds,
          regenerateFromSeq: options.regenerateFromSeq,
          webSearch: useWeb,
          imageGeneration: useImages,
        }),
      });

      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setError(payload.error ?? 'Erreur du serveur');
        return;
      }

      await readEventStream(res.body, (event, data) => {
        switch (event) {
          case 'user-message':
            setMessages((current) => [...current, data.message as Message]);
            break;
          case 'text':
            setLiveText((current) => current + (data.delta as string));
            break;
          case 'reasoning':
            setLiveReasoning((current) => current + (data.delta as string));
            break;
          case 'tool':
            setToolEvents((current) => [...current, data.name as string]);
            break;
          case 'done': {
            const message = data.message as Message;
            setMessages((current) => [...current, message]);
            setLiveText('');
            setLiveReasoning('');
            if (voiceSettings.autoplay && capabilities.voice) void speak(message.content);
            break;
          }
          case 'refresh':
            setConversation(data.conversation as Conversation);
            void refreshConversations();
            break;
          case 'error':
            setError(data.message as string);
            break;
        }
      });
      if (active) await openConversation(active.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      streamingRef.current = false;
      setStreaming(false);
    }

    const next = queueRef.current.shift();
    if (next) {
      setQueue([...queueRef.current]);
      void run({ text: next });
    }
  }

  /** Messages sent while Hydra is still answering are queued instead of dropped. */
  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setDraft('');
    if (streamingRef.current) {
      queueRef.current.push(trimmed);
      setQueue([...queueRef.current]);
      return;
    }
    void run({ text: trimmed });
  }

  function regenerate() {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
    if (!lastAssistant) return;
    void run({ regenerateFromSeq: lastAssistant.seq });
  }

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const form = new FormData();
        form.set('audio', new File(chunks, 'note.webm', { type: 'audio/webm' }));
        if (voiceSettings.language) form.set('language', voiceSettings.language);
        const res = await fetch('/api/transcribe', { method: 'POST', body: form });
        if (!res.ok) {
          setError(((await res.json()) as { error?: string }).error ?? 'Transcription impossible');
          return;
        }
        const { text } = (await res.json()) as { text: string };
        setDraft((current) => (current ? `${current} ${text}` : text));
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError('Micro indisponible');
    }
  }

  async function speak(text: string) {
    const res = await fetch('/api/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        voice: voiceSettings.voice || null,
        speed: voiceSettings.speed,
        language: voiceSettings.language || null,
        personaId: conversation?.persona_id ?? null,
      }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? 'Synthèse vocale indisponible');
      return;
    }
    const audio = new Audio(URL.createObjectURL(await res.blob()));
    void audio.play();
  }

  const attachmentsFor = (messageId: string) =>
    attachments.filter((a) => a.message_id === messageId);

  const suggestions = [
    'Explique-moi un sujet complexe simplement',
    'Aide-moi à écrire un texte',
    'Compare deux options pour moi',
    'Résume ce document (joins un fichier)',
  ];
  const selectedBot = personas.find((persona) => persona.id === selectedBotId) ?? null;
  const busyPersonaIds = new Set(
    streaming && conversation?.persona_id ? [conversation.persona_id] : [],
  );
  const streamingConversationId = streaming ? conversation?.id ?? null : null;

  return (
    <div className="relative flex h-full min-h-0">
      <a href="#chat-main" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-2 focus:rounded-md focus:bg-[var(--surface-2)] focus:px-3 focus:py-2">
        Aller au chat
      </a>
      {sidebarOpen && (
        <aside className="glass fixed inset-y-0 left-0 z-40 flex w-[264px] shrink-0 flex-col border-r border-[var(--border)] shadow-2xl md:relative md:z-auto md:shadow-none">
          <div className="flex items-center gap-2 px-4 py-4">
            <Mascot avatar="preset-hydra" size={26} alt="Hydra" />
            <span className="text-[15px] font-semibold tracking-tight">Hydra</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="btn btn-icon ml-auto text-[var(--muted)]"
              title="Masquer le panneau"
              aria-label="Masquer le panneau"
            >
              <IconSidebar />
            </button>
          </div>

          <div className="px-3 pb-3">
            <button
              onClick={() => void newConversation({ personaId: conversation?.persona_id ?? null })}
              className="btn btn-primary w-full"
            >
              <IconPlus />
              Nouvelle conversation
            </button>
          </div>

          <div className="flex-1 space-y-0.5 overflow-y-auto px-2">
            {initializing ? <LoadingState label="Chargement des conversations" /> : conversations.length === 0 && (
              <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">
                Aucune conversation.
              </p>
            )}
            {conversations.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center rounded-[10px] ${
                  conversation?.id === item.id ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                } ${item.parent_id ? 'ml-4 border-l border-[var(--border-strong)]' : ''}`}
              >
                <button
                  onClick={() => void openConversation(item.id)}
                  className={`flex-1 truncate px-3 py-2 text-left text-[13px] ${
                    conversation?.id === item.id ? '' : 'text-[var(--muted)]'
                  }`}
                  title={item.title}
                >
                  {item.title}
                </button>
                <button
                  onClick={() => void removeConversation(item.id)}
                  className="mr-1 rounded-md px-1.5 py-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--danger)] group-hover:opacity-100"
                  title="Supprimer"
                  aria-label={`Supprimer ${item.title}`}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>

          <div className="space-y-0.5 border-t border-[var(--border)] p-2">
            {[
              { key: 'persona' as const, Icon: IconPersona, label: 'Mes bots', show: true },
              { key: 'memory' as const, Icon: IconMemory, label: 'Mémoire', show: true },
              { key: 'voice' as const, Icon: IconVoice, label: 'Voix', show: capabilities.voice },
              { key: 'reminders' as const, Icon: IconReminder, label: 'Rappels', show: true },
              { key: 'library' as const, Icon: IconLibrary, label: 'Bibliothèque', show: true },
            ]
              .filter((entry) => entry.show)
              .map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setPanel(panel === entry.key ? 'none' : entry.key)}
                  className={`nav-item ${panel === entry.key ? 'nav-item-active' : ''}`}
                >
                  <entry.Icon />
                  {entry.label}
                </button>
              ))}
          </div>
        </aside>
      )}

      <main id="chat-main" className="flex min-w-0 flex-1 flex-col">
        <BotRail
          personas={personas}
          activePersonaId={conversation?.persona_id ?? null}
          selectedBotId={selectedBotId}
          busyPersonaIds={busyPersonaIds}
          onSelectBot={selectBot}
          onOpenStudio={() => setPanel('persona')}
          variant="horizontal"
        />
        <header className="glass flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2.5">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="btn btn-icon" title="Afficher le panneau">
              <IconSidebar />
            </button>
          )}
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            aria-label="Modèle"
            className="field max-w-[220px] min-w-0 flex-1 truncate sm:flex-none"
          >
            {availableModels.length === 0 && <option value="">Aucun modèle configuré</option>}
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>

          <select
            value={conversation?.persona_id ?? ''}
            onChange={(event) => void setConversationPersona(event.target.value || null)}
            disabled={!conversation}
            aria-label="Persona"
            className="field max-w-[180px] truncate"
          >
            <option value="">Persona par défaut</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.name}
              </option>
            ))}
          </select>

          {capabilities.webSearch && (
            <button
              onClick={() => setUseWeb(!useWeb)}
              className={`chip ${useWeb ? 'chip-active' : ''}`}
              title="Recherche web"
              aria-pressed={useWeb}
            >
              <IconGlobe className="h-3.5 w-3.5" /> Web
            </button>
          )}
          {capabilities.imageGeneration && (
            <button
              onClick={() => setUseImages(!useImages)}
              className={`chip ${useImages ? 'chip-active' : ''}`}
              title="Génération d’images"
              aria-pressed={useImages}
            >
              <IconImage className="h-3.5 w-3.5" /> Images
            </button>
          )}

          <button
            onClick={() =>
              void newConversation({
                personaId: conversation?.persona_id ?? null,
                parentId: conversation?.parent_id ?? conversation?.id ?? null,
              })
            }
            disabled={!conversation}
            className="chip"
            title="Ouvrir un fil parallèle qui partage la mémoire de cette conversation"
          >
            <IconBranch className="h-3.5 w-3.5" /> Fil parallèle
          </button>

          {activePersona && (
            <div className="ml-auto flex items-center gap-2 text-xs text-[var(--muted)]">
              <Mascot avatar={activePersona.avatar} size={24} alt={activePersona.name} />
              <span className="truncate">{activePersona.name}</span>
            </div>
          )}
        </header>

        {(sideChats.length > 0 || conversation?.parent_id) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2">
            {conversation?.parent_id && (
              <button onClick={() => void openConversation(conversation.parent_id!)} className="chip">
                <IconBack className="h-3.5 w-3.5" /> Fil principal
              </button>
            )}
            {sideChats.map((chat) => (
              <button key={chat.id} onClick={() => void openConversation(chat.id)} className="chip">
                <IconBranch className="h-3.5 w-3.5" /> {chat.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-5 sm:py-8">
            {loadingConversation && <LoadingState label="Chargement de la conversation" />}
            {messages.length === 0 && !streaming && !initializing && !loadingConversation && (
              <div className="fade-in mt-[12vh] text-center">
                <Mascot avatar="preset-hydra" size={72} className="mx-auto mb-5" alt="Hydra" />
                <h1 className="text-3xl font-semibold tracking-tight">Bonjour.</h1>
                <p className="mx-auto mt-3 max-w-md text-sm text-[var(--muted)]">
                  Un seul fil, plusieurs têtes. Change de modèle en pleine conversation : la
                  mémoire, le persona et le ton suivent.
                </p>
                <div className="mt-7 flex flex-wrap justify-center gap-2">
                  {suggestions.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setDraft(suggestion)}
                      className="card px-3 py-2 text-xs text-[var(--muted)] hover:text-[var(--foreground)]"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>

                <div className="mt-10">
                  <div className="mb-3 text-xs uppercase tracking-wide text-[var(--muted)]">
                    Tes bots
                  </div>
                  <div className="flex flex-wrap justify-center gap-4">
                    {personas.slice(0, 6).map((persona) => (
                      <button
                        key={persona.id}
                        onClick={() => selectBot(persona.id)}
                        className="flex w-20 flex-col items-center gap-1.5 text-[11px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                      >
                        <Mascot avatar={persona.avatar} size={52} alt={persona.name} />
                        <span className="truncate">{persona.name}</span>
                      </button>
                    ))}
                    <button
                      onClick={() => setPanel('persona')}
                      className="flex w-20 flex-col items-center gap-1.5 text-[11px] text-[var(--muted)] transition hover:text-[var(--foreground)]"
                    >
                      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full border border-dashed border-[var(--border-strong)]">
                        <IconPlus />
                      </span>
                      <span>Créer</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {messages.map((message) =>
              message.role === 'user' ? (
                <article key={message.id} className="fade-in mb-3 flex justify-end">
                  <div className="max-w-[78%]">
                    <div className="bubble bubble-me whitespace-pre-wrap">{message.content}</div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {attachmentsFor(message.id).map((attachment) =>
                        attachment.media_type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={attachment.id}
                            src={`/api/files/${attachment.id}`}
                            alt={attachment.name}
                            className="max-h-56 rounded-xl border border-[var(--border)]"
                          />
                        ) : (
                          <a
                            key={attachment.id}
                            href={`/api/files/${attachment.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="chip"
                          >
                            <IconClip className="h-3.5 w-3.5" /> {attachment.name}
                          </a>
                        ),
                      )}
                    </div>
                  </div>
                </article>
              ) : (
                <article key={message.id} className="fade-in group mb-3 flex items-end gap-2">
                  <Mascot
                    avatar={activePersona?.avatar ?? 'preset-hydra'}
                    size={28}
                    className="self-end"
                    alt="Hydra"
                  />
                  <div className="min-w-0 max-w-[82%]">
                    {message.reasoning && (
                      <details className="card mb-3 p-3 text-xs text-[var(--muted)]">
                        <summary className="cursor-pointer select-none">Raisonnement</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{message.reasoning}</pre>
                      </details>
                    )}
                    <div className="bubble bubble-them">
                      <Markdown>{message.content}</Markdown>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attachmentsFor(message.id).map((attachment) =>
                        attachment.media_type.startsWith('image/') ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={attachment.id}
                            src={`/api/files/${attachment.id}`}
                            alt={attachment.name}
                            className="max-h-72 rounded-xl border border-[var(--border)]"
                          />
                        ) : (
                          <a
                            key={attachment.id}
                            href={`/api/files/${attachment.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="chip"
                          >
                            <IconClip className="h-3.5 w-3.5" /> {attachment.name}
                          </a>
                        ),
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1 text-[11px] text-[var(--muted)] opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                        title="Copier"
                      >
                        <IconCopy className="h-3.5 w-3.5" /> Copier
                      </button>
                      {capabilities.voice && (
                        <button
                          onClick={() => void speak(message.content)}
                          className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                          title="Lire à voix haute"
                        >
                          <IconSpeaker className="h-3.5 w-3.5" /> Écouter
                        </button>
                      )}
                      {message.model_id && <span className="ml-1">{message.model_id}</span>}
                    </div>
                  </div>
                </article>
              ),
            )}

            {(liveReasoning || liveText || streaming) && (
              <article className="fade-in mb-3 flex items-end gap-2">
                <Mascot
                  avatar={activePersona?.avatar ?? 'preset-hydra'}
                  size={28}
                  className="self-end"
                  alt="Hydra"
                />
                <div className="min-w-0 max-w-[82%]">
                  {toolEvents.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {toolEvents.map((name, index) => (
                        <span key={index} className="chip">
                          {TOOL_LABELS[name] ?? name}…
                        </span>
                      ))}
                    </div>
                  )}
                  {liveReasoning && (
                    <details open className="card mb-3 p-3 text-xs text-[var(--muted)]">
                      <summary className="cursor-pointer select-none">Raisonnement…</summary>
                      <pre className="mt-2 whitespace-pre-wrap">{liveReasoning}</pre>
                    </details>
                  )}
                  <div className="bubble bubble-them">
                    {liveText ? (
                      <Markdown>{liveText}</Markdown>
                    ) : (
                      <span className="dots">
                        <span />
                        <span />
                        <span />
                      </span>
                    )}
                  </div>
                </div>
              </article>
            )}

            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-4 pb-5">
          <div className="mx-auto w-full max-w-3xl">
            {queue.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {queue.map((text, index) => (
                  <span key={index} className="chip max-w-full truncate">
                    <IconClock className="h-3.5 w-3.5" /> {text}
                  </span>
                ))}
              </div>
            )}
            {pending.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pending.map((attachment) => (
                  <span key={attachment.id} className="chip">
                    <IconClip className="h-3.5 w-3.5" /> {attachment.name}
                  </span>
                ))}
              </div>
            )}
            <div className="composer flex items-end gap-1.5 p-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                hidden
                accept="image/*,application/pdf,text/plain,text/markdown"
                onChange={(event) => {
                  if (event.target.files) void uploadFiles(event.target.files);
                  event.target.value = '';
                }}
              />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-icon text-[var(--muted)]"
                  title="Joindre un fichier"
                  aria-label="Joindre un fichier"
              >
                <IconClip />
              </button>
              {capabilities.voice && (
                <button
                  onClick={() => void toggleRecording()}
                  className={`btn btn-icon ${recording ? 'text-[var(--danger)]' : 'text-[var(--muted)]'}`}
                  title={recording ? 'Arrêter la dictée' : 'Dicter'}
                  aria-label={recording ? 'Arrêter la dictée' : 'Dicter'}
                >
                  {recording ? <IconStop /> : <IconMic />}
                </button>
              )}
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder={
                  streaming
                    ? 'Ajouter un message à la file…'
                    : `Écris à ${activePersona?.name ?? 'Hydra'}…`
                }
                aria-label="Message"
                className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-[var(--muted)]"
              />
              <button
                onClick={regenerate}
                disabled={streaming || messages.length === 0}
                className="btn btn-icon text-[var(--muted)]"
                title="Régénérer la dernière réponse"
                aria-label="Régénérer la dernière réponse"
              >
                <IconRefresh />
              </button>
              <button
                onClick={() => send(draft)}
                disabled={!draft.trim()}
                className="btn btn-primary btn-icon"
                title={streaming ? 'Mettre en file' : 'Envoyer'}
                aria-label={streaming ? 'Mettre en file' : 'Envoyer'}
              >
                <IconArrowUp />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
              Entrée pour envoyer · Maj+Entrée pour une nouvelle ligne
            </p>
          </div>
        </div>
      </main>

      {toast && <div className="pointer-events-none fixed bottom-5 left-1/2 z-[70] -translate-x-1/2 toast" role="status">{toast}</div>}
      {panel === 'memory' && (
        <MemoryPanel
          conversationId={conversation?.id ?? null}
          memories={memories}
          onClose={() => setPanel('none')}
          onChange={async () => {
            if (conversation) await openConversation(conversation.id);
          }}
        />
      )}
      {panel === 'persona' && (
        <BotStudio
          personas={personas}
          models={availableModels}
          voices={voices}
          activeId={selectedBotId ?? conversation?.persona_id ?? null}
          onClose={() => setPanel('none')}
          onSelect={(id) => void setConversationPersona(id)}
          onChange={refreshPersonas}
          onStartChat={(id) => startChatWithBot(id)}
        />
      )}
      {panel === 'voice' && (
        <VoicePanel
          voices={voices}
          provider={voiceProvider}
          cloning={capabilities.voiceCloning}
          settings={voiceSettings}
          onSettings={updateVoiceSettings}
          onVoicesChange={refreshVoices}
          onPreview={speak}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'reminders' && (
        <RemindersPanel conversationId={conversation?.id ?? null} onClose={() => setPanel('none')} />
      )}
      {panel === 'library' && <LibraryPanel onClose={() => setPanel('none')} />}
      {panel === 'computer' && selectedBot && (
        <BotComputer
          persona={selectedBot}
          conversations={conversations.filter((item) => item.persona_id === selectedBot.id)}
          currentConversationId={conversation?.id ?? null}
          streamingConversationId={streamingConversationId}
          onOpenConversation={(id) => void openConversation(id)}
          onNewConversation={(personaId) => void startChatWithBot(personaId)}
          onEditBot={(personaId) => {
            setSelectedBotId(personaId);
            setPanel('persona');
          }}
          onClose={() => setPanel('none')}
        />
      )}
      <BotRail
        personas={personas}
        activePersonaId={conversation?.persona_id ?? null}
        selectedBotId={selectedBotId}
        busyPersonaIds={busyPersonaIds}
        onSelectBot={selectBot}
        onOpenStudio={() => setPanel('persona')}
        variant="vertical"
      />
    </div>
  );
}
