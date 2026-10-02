'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import {
  IconArrowUp,
  IconBack,
  IconBranch,
  IconClock,
  IconClip,
  IconCopy,
  IconCompose,
  IconDocument,
  IconGlobe,
  IconImage,
  IconInfo,
  IconLibrary,
  IconMemory,
  IconMic,
  IconMore,
  IconPersona,
  IconRefresh,
  IconReminder,
  IconSearch,
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
import { RemindersPanel } from '@/components/reminders-panel';
import { DEFAULT_VOICE_SETTINGS, VoicePanel, type VoiceSettings } from '@/components/voice-panel';
import type { Attachment, Conversation, Memory, Message, Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import { readEventStream } from '@/lib/sse';
import type { VoiceInfo } from '@/lib/voice';
import { ErrorState, LoadingState } from '@/components/ui';
import { WorkPanel } from '@/components/work-panel';

interface Capabilities {
  webSearch: boolean;
  imageGeneration: boolean;
  voice: boolean;
  voiceCloning: boolean;
}

type ThreadOverlay =
  | { kind: 'none' }
  | { kind: 'menu' }
  | { kind: 'actions'; messageId: string };

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
  workspace_list: 'lecture de l’ordinateur',
  workspace_read: 'lecture de fichier',
  workspace_write: 'écriture',
  workspace_delete: 'suppression',
  workspace_shell: 'commande',
  forget: 'oubli',
  update_artifact: 'mise à jour d’artefact',
  handoff: 'relais',
};

interface ActivityItem {
  id: string;
  kind: string;
  name: string;
  detail: string;
  created_at: string;
}

interface ReactionItem {
  message_id: string;
  emoji: string;
}

interface ApprovalItem {
  id: string;
  tool: string;
  status: string;
  input_json: string;
}

interface SkillItem {
  id: string;
  slug: string;
  name: string;
}

interface SearchHit {
  messageId: string;
  conversationId: string;
  title: string;
  excerpt: string;
}

type SidebarTab = 'bots' | 'conversations';

function dayKey(value: string): string {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const start = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' }).format(date);
}

function clockTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function listTime(value: string): string {
  const date = new Date(value);
  const today = new Date();
  const key = (item: Date) => `${item.getFullYear()}-${item.getMonth()}-${item.getDate()}`;
  if (key(date) === key(today)) return clockTime(value);
  const start = (item: Date) => new Date(item.getFullYear(), item.getMonth(), item.getDate()).getTime();
  const diff = Math.round((start(today) - start(date)) / 86400000);
  if (diff === 1) return 'hier';
  if (diff < 7) return new Intl.DateTimeFormat('fr-FR', { weekday: 'short' }).format(date);
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' }).format(date);
}

function closeSidebarIfNarrow(setOpen: (open: boolean) => void) {
  if (window.matchMedia('(max-width: 767px)').matches) setOpen(false);
}

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
    'none' | 'memory' | 'persona' | 'voice' | 'reminders' | 'library' | 'computer' | 'work'
  >('none');
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [reactions, setReactions] = useState<ReactionItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [preview, setPreview] = useState<{ url: string; name: string } | null>(null);
  const [overlay, setOverlay] = useState<ThreadOverlay>({ kind: 'none' });
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('conversations');
  const [replySettled, setReplySettled] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');
  const [recording, setRecording] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const queueRef = useRef<string[]>([]);
  const streamingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const menuRootRef = useRef<HTMLDivElement | null>(null);

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
      activities: ActivityItem[];
      reactions: ReactionItem[];
      approvals: ApprovalItem[];
    };
    setConversation(data.conversation);
    setSelectedBotId(data.conversation.persona_id);
    setMessages(data.messages);
    setMemories(data.memories);
    setAttachments(data.attachments);
    setSideChats(data.sideChats);
    setActivities(data.activities ?? []);
    setReactions(data.reactions ?? []);
    setApprovals(data.approvals ?? []);
    setLiveText('');
    setLiveReasoning('');
    setToolEvents([]);
    if (data.conversation.default_model) setModelId(data.conversation.default_model);
    setLoadingConversation(false);
    closeSidebarIfNarrow(setSidebarOpen);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (window.matchMedia('(min-width: 768px)').matches) setSidebarOpen(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const tick = () => {
      void fetch('/api/routines/tick', { method: 'POST' });
    };
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    void fetch('/api/skills')
      .then((res) => (res.ok ? res.json() : { skills: [] }))
      .then((data: { skills: SkillItem[] }) => setSkills(data.skills));
  }, [panel]);

  useEffect(() => {
    const query = sidebarQuery.trim();
    if (query.length < 2) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((res) => (res.ok ? res.json() : { hits: [] }))
        .then((data: { hits: SearchHit[] }) => setSearchHits(data.hits));
    }, 200);
    return () => window.clearTimeout(timer);
  }, [sidebarQuery]);

  useEffect(() => {
    if (overlay.kind !== 'menu') return;
    const onPointerDown = (event: PointerEvent) => {
      const root = menuRootRef.current;
      if (root && event.target instanceof Node && root.contains(event.target)) return;
      setOverlay({ kind: 'none' });
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [overlay.kind]);

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

  async function startChatWithBot(personaId: string, options?: { keepPanel?: boolean }) {
    const created = await newConversation({ personaId, usePersonaModel: true });
    await openConversation(created.id);
    setSelectedBotId(personaId);
    if (!options?.keepPanel && panel !== 'computer') setPanel('none');
  }

  async function startVoiceWithBot(personaId: string) {
    await startChatWithBot(personaId, { keepPanel: true });
    setPanel('voice');
  }

  async function selectBot(id: string) {
    const recent = conversations
      .filter((item) => item.persona_id === id)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
    setSelectedBotId(id);
    if (recent) {
      await openConversation(recent.id);
    } else {
      await startChatWithBot(id);
    }
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
    setReplySettled(false);
    setLiveText('');
    setLiveReasoning('');
    setToolEvents([]);
    setDraft('');
    setPending([]);
    setReplyTo(null);
    const controller = new AbortController();
    abortRef.current = controller;

    if (options.regenerateFromSeq !== undefined) {
      setMessages((current) => current.filter((m) => m.seq < options.regenerateFromSeq!));
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: active.id,
          modelId,
          text: options.text,
          attachmentIds,
          replyToId: replyTo?.id,
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
            setReplySettled(true);
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
      if ((err as Error).name === 'AbortError') {
        if (active) await openConversation(active.id);
      } else {
        setError((err as Error).message);
      }
    } finally {
      abortRef.current = null;
      streamingRef.current = false;
      setStreaming(false);
    }

    const next = queueRef.current.shift();
    if (next) {
      setQueue([...queueRef.current]);
      void run({ text: next });
    }
  }

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (streamingRef.current) {
      queueRef.current.push(trimmed);
      setQueue([...queueRef.current]);
      setDraft('');
      return;
    }
    if (!modelId) {
      setError("Aucun modèle disponible : configure au moins une clé API dans le fichier .env");
      return;
    }
    setDraft('');
    void run({ text: trimmed });
  }

  function stop() {
    abortRef.current?.abort();
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

  async function react(messageId: string, emoji: string) {
    const res = await fetch(`/api/messages/${messageId}/reactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emoji }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { reactions: ReactionItem[] };
    setReactions((current) => [...current.filter((item) => item.message_id !== messageId), ...data.reactions]);
  }

  async function decide(id: string, decision: 'approve' | 'reject') {
    const res = await fetch(`/api/approvals/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? 'Décision impossible');
      return;
    }
    if (conversation) await openConversation(conversation.id);
    setToast(decision === 'approve' ? 'Action approuvée' : 'Action refusée');
  }

  function attachmentNode(attachment: Attachment) {
    if (attachment.media_type.startsWith('image/')) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={attachment.id}
          src={`/api/files/${attachment.id}`}
          alt={attachment.name}
          className="max-h-72 rounded-xl border border-[var(--border)]"
        />
      );
    }
    if (attachment.media_type === 'text/html' || attachment.name.endsWith('.html')) {
      return (
        <button
          key={attachment.id}
          type="button"
          className="chip"
          onClick={() => setPreview({ url: `/api/files/${attachment.id}`, name: attachment.name })}
        >
          Aperçu {attachment.name}
        </button>
      );
    }
    return (
      <a key={attachment.id} href={`/api/files/${attachment.id}`} target="_blank" rel="noreferrer" className="chip">
        <IconClip className="h-3.5 w-3.5" /> {attachment.name}
      </a>
    );
  }

  const attachmentsFor = (messageId: string) =>
    attachments.filter((a) => a.message_id === messageId);

  const selectedBot = personas.find((persona) => persona.id === selectedBotId) ?? null;
  const streamingConversationId = streaming ? conversation?.id ?? null : null;
  const conversationsByBot = new Map<string, Conversation>();
  for (const item of conversations) {
    if (!item.persona_id) continue;
    const current = conversationsByBot.get(item.persona_id);
    if (!current || item.updated_at > current.updated_at) {
      conversationsByBot.set(item.persona_id, item);
    }
  }
  const normalizedSidebarQuery = sidebarQuery.trim().toLocaleLowerCase();
  const filteredPersonas = personas.filter((persona) => {
    if (!normalizedSidebarQuery) return true;
    const recent = conversationsByBot.get(persona.id);
    return [persona.name, persona.tagline, recent?.title].some((value) =>
      value?.toLocaleLowerCase().includes(normalizedSidebarQuery),
    );
  });
  const filteredConversations = conversations.filter((item) =>
    !normalizedSidebarQuery || item.title.toLocaleLowerCase().includes(normalizedSidebarQuery),
  );
  const headerPersona = activePersona ?? {
    id: '',
    name: 'Hydra',
    tagline: 'Ton espace de conversation',
    avatar: 'preset-hydra',
  };
  const latestTool = toolEvents.at(-1);
  const headerStatus = !streaming
    ? headerPersona.tagline
    : latestTool === 'web_search' && !liveText
      ? 'cherche…'
      : latestTool && !liveText
        ? `${TOOL_LABELS[latestTool] ?? latestTool}…`
        : 'écrit…';
  const showWaiting = streaming && !liveText && !replySettled;
  const lastAssistantId = [...messages].reverse().find((item) => item.role === 'assistant')?.id ?? null;

  function toggleMessageActions(event: MouseEvent<HTMLElement>, messageId: string) {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('button, a, summary, input')) return;
    setOverlay((current) =>
      current.kind === 'actions' && current.messageId === messageId
        ? { kind: 'none' }
        : { kind: 'actions', messageId },
    );
  }

  function actionsClass(messageId: string) {
    const open = overlay.kind === 'actions' && overlay.messageId === messageId;
    return `mt-1 flex items-center gap-1 text-[11px] text-[var(--muted)] transition ${
      open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
    }`;
  }

  return (
    <div className="relative flex h-full min-h-0">
      <a href="#chat-main" className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:m-2 focus:rounded-md focus:bg-[var(--surface-2)] focus:px-3 focus:py-2">
        Aller au chat
      </a>
      {sidebarOpen && (
        <aside className="glass fixed inset-0 z-40 flex w-full shrink-0 flex-col border-r border-[var(--border)] shadow-2xl md:relative md:inset-auto md:z-auto md:w-[340px] md:max-w-[340px] md:shadow-none">
          <div className="flex items-center px-5 pb-1 pt-5">
            <h1 className="text-[28px] font-bold tracking-tight">Messages</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="btn btn-icon ml-auto text-[var(--muted)] md:hidden"
              title="Masquer le panneau"
              aria-label="Masquer le panneau"
            >
              <IconSidebar />
            </button>
            <button
              onClick={() => {
                void (async () => {
                  const created = await newConversation({ personaId: conversation?.persona_id ?? null });
                  await openConversation(created.id);
                })();
              }}
              className="btn btn-icon md:ml-auto"
              title="Nouvelle conversation"
              aria-label="Nouvelle conversation"
            >
              <IconCompose />
            </button>
          </div>

          <div role="tablist" aria-label="Messages" className="flex border-b border-[var(--border)] px-5">
            {([
              ['conversations', 'Conversations'],
              ['bots', 'Bots'],
            ] as const).map(([tab, label]) => (
              <button
                key={tab}
                role="tab"
                aria-selected={sidebarTab === tab}
                onClick={() => {
                  setSidebarTab(tab);
                  setSidebarQuery('');
                  setSearchHits([]);
                }}
                className={`relative flex-1 px-2 pb-3 pt-1 text-sm font-semibold ${
                  sidebarTab === tab ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'
                }`}
              >
                {label}
                {sidebarTab === tab && (
                  <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--foreground)]" />
                )}
              </button>
            ))}
          </div>

          <div className="px-4 py-3">
            <label className="relative block">
              <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={sidebarQuery}
                onChange={(event) => {
                  setSidebarQuery(event.target.value);
                  if (event.target.value.trim().length < 2) setSearchHits([]);
                }}
                placeholder="Rechercher"
                aria-label="Rechercher"
                className="field w-full rounded-full py-2 pl-9 pr-3"
              />
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            {sidebarTab === 'bots' ? (
              <>
                <div className="mb-3 flex gap-4 overflow-x-auto px-5 pb-1">
                  {filteredPersonas.map((persona) => {
                    const selected = selectedBotId === persona.id || conversation?.persona_id === persona.id;
                    return (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => void selectBot(persona.id)}
                        className="flex w-16 shrink-0 flex-col items-center gap-1 text-[11px] text-[var(--muted)]"
                        title={persona.name}
                      >
                        <span className="relative pt-5">
                          {selected && (
                            <span className="absolute left-1/2 top-0 z-10 w-16 -translate-x-1/2 rounded-2xl bg-[var(--surface-2)] px-1.5 py-1 text-[10px] leading-tight text-[var(--foreground)] shadow-lg">
                              {persona.tagline}
                            </span>
                          )}
                          <Mascot avatar={persona.avatar} size={56} alt={persona.name} />
                        </span>
                        <span className="max-w-full truncate">{persona.name}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="space-y-0.5 px-2">
                  {initializing ? (
                    <LoadingState label="Chargement des bots" />
                  ) : filteredPersonas.length === 0 ? (
                    <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">Aucun bot trouvé.</p>
                  ) : (
                    filteredPersonas.map((persona) => {
                      const recent = conversationsByBot.get(persona.id);
                      return (
                        <button
                          key={persona.id}
                          type="button"
                          onClick={() => void selectBot(persona.id)}
                          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--surface-2)] ${
                            conversation?.persona_id === persona.id ? 'bg-[var(--surface-2)]' : ''
                          }`}
                        >
                          <span className="relative shrink-0">
                            <Mascot avatar={persona.avatar} size={48} alt={persona.name} />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium">{persona.name}</span>
                            <span className="block truncate text-xs text-[var(--muted)]">
                              {recent ? `${recent.title} · ${listTime(recent.updated_at)}` : persona.tagline}
                            </span>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <div className="space-y-0.5 px-2">
                {initializing ? (
                  <LoadingState label="Chargement des conversations" />
                ) : filteredConversations.length === 0 ? (
                  <p className="px-3 py-6 text-center text-xs text-[var(--muted)]">Aucune conversation.</p>
                ) : (
                  filteredConversations.map((item) => {
                    const persona = personas.find((candidate) => candidate.id === item.persona_id);
                    return (
                      <div
                        key={item.id}
                        className={`group flex items-center gap-2 rounded-xl ${
                          conversation?.id === item.id ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                        } ${item.parent_id ? 'ml-4 border-l border-[var(--border-strong)]' : ''}`}
                      >
                        <button
                          type="button"
                          onClick={() => void openConversation(item.id)}
                          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-left"
                          title={item.title}
                        >
                          <Mascot avatar={persona?.avatar ?? 'preset-hydra'} size={40} alt={persona?.name ?? 'Hydra'} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-baseline justify-between gap-2">
                              <span className="truncate text-sm font-medium">{persona?.name ?? item.title}</span>
                              <span className="shrink-0 text-xs text-[var(--muted)]">{listTime(item.updated_at)}</span>
                            </span>
                            <span className="block truncate text-xs text-[var(--muted)]">{item.title}</span>
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeConversation(item.id)}
                          className="mr-1 rounded-md px-1.5 py-1 text-[var(--muted)] opacity-0 transition hover:text-[var(--danger)] group-hover:opacity-100"
                          title="Supprimer"
                          aria-label={`Supprimer ${item.title}`}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {searchHits.length > 0 && (
            <div className="border-t border-[var(--border)] px-3 py-2">
              <p className="mb-1 text-[11px] text-[var(--muted)]">Messages</p>
              {searchHits.map((hit) => (
                <button
                  key={hit.messageId}
                  type="button"
                  onClick={() => void openConversation(hit.conversationId)}
                  className="block w-full truncate py-1 text-left text-xs"
                >
                  <span className="font-medium">{hit.title}</span>
                  <span className="text-[var(--muted)]"> · {hit.excerpt}</span>
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-4 gap-1 border-t border-[var(--border)] p-2">
            {[
              { key: 'persona' as const, Icon: IconPersona, label: 'Mes bots', show: true },
              { key: 'memory' as const, Icon: IconMemory, label: 'Mémoire', show: true },
              { key: 'reminders' as const, Icon: IconReminder, label: 'Rappels', show: true },
              { key: 'library' as const, Icon: IconLibrary, label: 'Bibliothèque', show: true },
            ]
              .filter((entry) => entry.show)
              .map((entry) => (
                <button
                  key={entry.key}
                  onClick={() => setPanel(panel === entry.key ? 'none' : entry.key)}
                  className={`flex flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] ${
                    panel === entry.key ? 'bg-[var(--surface-2)] text-[var(--foreground)]' : 'text-[var(--muted)]'
                  }`}
                >
                  <entry.Icon className="h-4 w-4" />
                  {entry.label}
                </button>
              ))}
          </div>
        </aside>
      )}

      <main id="chat-main" className="flex min-w-0 flex-1 flex-col">
        <header className="glass relative z-30 flex min-h-[66px] items-center gap-3 border-b border-[var(--border)] px-4 py-2.5">
          {!sidebarOpen && (
            <button onClick={() => setSidebarOpen(true)} className="btn btn-icon shrink-0" title="Messages" aria-label="Messages">
              <IconBack />
            </button>
          )}
          <Mascot avatar={headerPersona.avatar} size={40} alt="" />
          <div className="min-w-0">
            <div className="truncate text-base font-semibold">{headerPersona.name}</div>
            <div className={`truncate text-xs ${streaming ? 'text-[var(--foreground)]' : 'text-[var(--muted)]'}`}>{headerStatus}</div>
          </div>

          <div ref={menuRootRef} className="relative ml-auto shrink-0">
            <button
              type="button"
              onClick={() => setOverlay((current) => (current.kind === 'menu' ? { kind: 'none' } : { kind: 'menu' }))}
              className="btn btn-icon ml-auto text-[var(--muted)]"
              title="Options"
              aria-label="Options"
              aria-expanded={overlay.kind === 'menu'}
            >
              <IconMore />
            </button>
            {overlay.kind === 'menu' && (
              <div className="absolute right-0 top-full z-30 mt-2 flex w-60 flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
                <select
                  value={modelId}
                  onChange={(event) => setModelId(event.target.value)}
                  aria-label="Modèle"
                  className="field w-full rounded-full py-1.5 text-xs"
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
                  className="field w-full rounded-full py-1.5 text-xs"
                >
                  <option value="">Persona par défaut</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.name}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap items-center gap-1.5">
                  {capabilities.webSearch && (
                    <button
                      type="button"
                      onClick={() => setUseWeb(!useWeb)}
                      className={`btn btn-icon ${useWeb ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                      title="Recherche web"
                      aria-pressed={useWeb}
                    >
                      <IconGlobe className="h-4 w-4" />
                    </button>
                  )}
                  {capabilities.imageGeneration && (
                    <button
                      type="button"
                      onClick={() => setUseImages(!useImages)}
                      className={`btn btn-icon ${useImages ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                      title="Génération d’images"
                      aria-pressed={useImages}
                    >
                      <IconImage className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      void newConversation({
                        personaId: conversation?.persona_id ?? null,
                        parentId: conversation?.parent_id ?? conversation?.id ?? null,
                      })
                    }
                    disabled={!conversation}
                    className="btn btn-icon text-[var(--muted)]"
                    title="Fil parallèle"
                    aria-label="Fil parallèle"
                  >
                    <IconBranch className="h-4 w-4" />
                  </button>
                  {capabilities.voice && (
                    <button
                      type="button"
                      onClick={() => {
                        setPanel(panel === 'voice' ? 'none' : 'voice');
                        setOverlay({ kind: 'none' });
                      }}
                      className={`btn btn-icon ${panel === 'voice' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                      title="Voix"
                      aria-label="Voix"
                    >
                      <IconVoice className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (!activePersona) return;
                      setSelectedBotId(activePersona.id);
                      setPanel(panel === 'computer' && selectedBotId === activePersona.id ? 'none' : 'computer');
                      setOverlay({ kind: 'none' });
                    }}
                    disabled={!activePersona}
                    className="btn btn-icon text-[var(--muted)]"
                    title="Informations du compagnon"
                    aria-label="Informations du compagnon"
                  >
                    <IconInfo className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPanel(panel === 'work' ? 'none' : 'work')}
                    className={`btn btn-icon ${panel === 'work' ? 'text-[var(--accent)]' : 'text-[var(--muted)]'}`}
                    title="Compétences et routines"
                    aria-label="Compétences et routines"
                  >
                    <IconDocument className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
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
            {activities.length > 0 && (
              <details className="mb-4 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer">Journal d’activité</summary>
                <ul className="mt-2 space-y-1">
                  {activities.slice(-8).map((item) => (
                    <li key={item.id}>
                      {item.kind} · {item.name}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {loadingConversation && <LoadingState label="Chargement de la conversation" />}
            {messages.length === 0 && !streaming && !initializing && !loadingConversation && (
              <div className="fade-in flex min-h-[46vh] flex-col items-center justify-center text-center">
                <Mascot avatar={headerPersona.avatar} size={72} alt="" />
                <h1 className="mt-3 text-lg font-semibold">{headerPersona.name}</h1>
                <p className="mt-1 text-sm text-[var(--muted)]">{headerPersona.tagline}</p>
              </div>
            )}

            {messages.map((message, index) => {
              const previous = messages[index - 1];
              const showDay = !previous || dayKey(previous.created_at) !== dayKey(message.created_at);
              const day = showDay ? (
                <p key={`day-${message.id}`} className="mb-3 mt-2 text-center text-xs text-[var(--muted)]">
                  {dayLabel(message.created_at)}
                </p>
              ) : null;
              return message.role === 'user' ? (
                <div key={message.id}>
                  {day}
                <article className="fade-in group mb-3 flex justify-end" onClick={(event) => toggleMessageActions(event, message.id)}>
                  <div className="max-w-[78%]">
                    <div className="bubble bubble-me whitespace-pre-wrap">
                      {message.reply_to_id && (
                        <p className="mb-1 line-clamp-2 text-[11px] text-white/75">
                          {messages.find((item) => item.id === message.reply_to_id)?.content}
                        </p>
                      )}
                      {message.content}
                      <time className="mt-1 block text-right text-[11px] text-white/75">{clockTime(message.created_at)}</time>
                    </div>
                    <div className={`${actionsClass(message.id)} justify-end`}>
                      <button
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                        title="Copier"
                        aria-label="Copier"
                      >
                        <IconCopy className="h-3.5 w-3.5" /> Copier
                      </button>
                      <button type="button" onClick={() => setReplyTo(message)} className="btn px-2 py-1 text-[11px] text-[var(--muted)]" aria-label="Répondre">
                        Répondre
                      </button>
                      <button type="button" onClick={() => void react(message.id, '👍')} className="btn px-2 py-1 text-[11px]" aria-label="Réagir">
                        👍
                      </button>
                    </div>
                    <div className="mt-1 flex justify-end gap-1 text-xs">
                      {reactions.filter((item) => item.message_id === message.id).map((item) => (
                        <span key={item.emoji}>{item.emoji}</span>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-2">
                      {attachmentsFor(message.id).map((attachment) => attachmentNode(attachment))}
                    </div>
                  </div>
                </article>
                </div>
              ) : (
                <div key={message.id}>
                  {day}
                <article
                  className="fade-in group mb-3 flex items-end gap-2"
                  onClick={(event) => toggleMessageActions(event, message.id)}
                >
                  <Mascot
                    avatar={activePersona?.avatar ?? 'preset-hydra'}
                    size={22}
                    className="mb-1"
                    alt=""
                  />
                  <div className="min-w-0 max-w-[82%]">
                    {message.reasoning && (
                      <details className="mb-1 text-xs text-[var(--muted)]">
                        <summary className="cursor-pointer select-none">Raisonnement</summary>
                        <pre className="mt-2 whitespace-pre-wrap">{message.reasoning}</pre>
                      </details>
                    )}
                    <div className="bubble bubble-them">
                      {message.reply_to_id && (
                        <p className="mb-1 line-clamp-2 text-[11px] text-[var(--muted)]">
                          {messages.find((item) => item.id === message.reply_to_id)?.content}
                        </p>
                      )}
                      <Markdown>{message.content}</Markdown>
                      <time className="mt-1 block text-right text-[11px] text-[var(--muted)]">{clockTime(message.created_at)}</time>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {attachmentsFor(message.id).map((attachment) => attachmentNode(attachment))}
                    </div>
                    <div className="mt-1 flex gap-1 text-xs">
                      {reactions.filter((item) => item.message_id === message.id).map((item) => (
                        <span key={item.emoji}>{item.emoji}</span>
                      ))}
                    </div>
                    <div className={actionsClass(message.id)}>
                      <button
                        onClick={() => void navigator.clipboard.writeText(message.content)}
                        className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                        title="Copier"
                        aria-label="Copier"
                      >
                        <IconCopy className="h-3.5 w-3.5" /> Copier
                      </button>
                      <button type="button" onClick={() => setReplyTo(message)} className="btn px-2 py-1 text-[11px] text-[var(--muted)]" aria-label="Répondre">
                        Répondre
                      </button>
                      <button type="button" onClick={() => void react(message.id, '👍')} className="btn px-2 py-1 text-[11px]" aria-label="Réagir">
                        👍
                      </button>
                      {capabilities.voice && (
                        <button
                          onClick={() => void speak(message.content)}
                          className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                          title="Lire à voix haute"
                          aria-label="Lire à voix haute"
                        >
                          <IconSpeaker className="h-3.5 w-3.5" /> Écouter
                        </button>
                      )}
                      {message.id === lastAssistantId && (
                        <button
                          onClick={regenerate}
                          disabled={streaming}
                          className="btn px-2 py-1 text-[11px] text-[var(--muted)]"
                          title="Régénérer"
                          aria-label="Régénérer"
                        >
                          <IconRefresh className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </article>
                </div>
              );
            })}

            {liveReasoning && (
              <details className="mb-2 text-xs text-[var(--muted)]" open>
                <summary className="cursor-pointer">Raisonnement</summary>
                <pre className="mt-2 whitespace-pre-wrap">{liveReasoning}</pre>
              </details>
            )}
            {liveText && (
              <article className="fade-in mb-3 flex items-end gap-2">
                <Mascot avatar={activePersona?.avatar ?? 'preset-hydra'} size={22} className="mb-1" alt="" />
                <div className="bubble bubble-them min-w-0 max-w-[82%]">
                  <Markdown>{liveText}</Markdown>
                </div>
              </article>
            )}
            {showWaiting && (
              <div className="wait-mark" aria-live="polite" aria-label="En train d’écrire">
                <span className="pip" />
                <span>...</span>
              </div>
            )}

            {error && <ErrorState message={error} onRetry={() => setError(null)} />}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="px-4 pb-5">
          <div className="mx-auto w-full max-w-3xl">
            {approvals
              .filter((item) => item.status === 'pending' || item.status === 'failed')
              .map((item) => (
                <div key={item.id} className="card mb-2 flex flex-wrap items-center gap-2 p-2 text-xs">
                  <span className="font-medium">{TOOL_LABELS[item.tool] ?? item.tool}</span>
                  <span className="text-[var(--muted)]">{item.status === 'failed' ? 'échec' : 'en attente'}</span>
                  <button type="button" className="btn btn-primary px-2 py-1" onClick={() => void decide(item.id, 'approve')}>
                    Approuver
                  </button>
                  <button type="button" className="btn px-2 py-1" onClick={() => void decide(item.id, 'reject')}>
                    Refuser
                  </button>
                </div>
              ))}
            {replyTo && (
              <div className="mb-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span className="min-w-0 flex-1 truncate">Réponse à {replyTo.content}</span>
                <button type="button" className="btn px-2 py-1" onClick={() => setReplyTo(null)} aria-label="Annuler la réponse">
                  Annuler
                </button>
              </div>
            )}
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
            {(() => {
              const match = draft.match(/(?:^|\s)\/([a-z0-9-]*)$/);
              if (!match) return null;
              const query = match[1] ?? '';
              const hits = skills.filter((skill) => skill.slug.startsWith(query)).slice(0, 6);
              if (hits.length === 0) return null;
              return (
                <div className="mb-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
                  {hits.map((skill) => (
                    <button
                      key={skill.id}
                      type="button"
                      className="block w-full rounded-lg px-2 py-1 text-left text-sm hover:bg-[var(--surface-2)]"
                      onClick={() => setDraft(draft.replace(/\/[a-z0-9-]*$/, `/${skill.slug} `))}
                    >
                      /{skill.slug} <span className="text-[var(--muted)]">{skill.name}</span>
                    </button>
                  ))}
                </div>
              );
            })()}
            <div className="composer flex items-end gap-1.5 rounded-full border-[var(--border)] p-1.5">
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
              <textarea
                value={draft}
                onChange={(event) => {
                  setDraft(event.target.value);
                  event.target.style.height = 'auto';
                  event.target.style.height = `${Math.min(event.target.scrollHeight, 192)}px`;
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    send(draft);
                  }
                }}
                rows={1}
                placeholder="Message…"
                aria-label="Message"
                className="max-h-48 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-[15px] outline-none placeholder:text-[var(--muted)]"
              />
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
              {streaming ? (
                <button
                  onClick={stop}
                  className="btn btn-icon bg-[var(--foreground)] text-[var(--background)]"
                  title="Arrêter"
                  aria-label="Arrêter la réponse"
                >
                  <span className="block h-3 w-3 rounded-[2px] bg-[var(--background)]" />
                </button>
              ) : (
                <button
                  onClick={() => send(draft)}
                  disabled={!draft.trim()}
                  className="btn btn-primary btn-icon"
                  title="Envoyer"
                  aria-label="Envoyer"
                >
                  <IconArrowUp />
                </button>
              )}
            </div>
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
      {panel === 'work' && (
        <WorkPanel
          personas={personas.map((persona) => ({ id: persona.id, name: persona.name }))}
          activePersonaId={conversation?.persona_id ?? null}
          onClose={() => setPanel('none')}
        />
      )}
      {preview && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={preview.name}>
          <div className="flex h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-2">
              <span className="truncate text-sm">{preview.name}</span>
              <button type="button" className="btn px-2 py-1 text-xs" onClick={() => setPreview(null)} aria-label="Fermer l’aperçu">
                Fermer
              </button>
            </div>
            <iframe title={preview.name} src={preview.url} sandbox="" className="h-full w-full bg-white" />
          </div>
        </div>
      )}
      {panel === 'computer' && selectedBot && (
        <BotComputer
          persona={selectedBot}
          conversations={conversations.filter((item) => item.persona_id === selectedBot.id)}
          currentConversationId={conversation?.id ?? null}
          streamingConversationId={streamingConversationId}
          onOpenConversation={(id) => void openConversation(id)}
          onNewConversation={(personaId) => void startChatWithBot(personaId)}
          onVoice={(personaId) => void startVoiceWithBot(personaId)}
          onEditBot={(personaId) => {
            setSelectedBotId(personaId);
            setPanel('persona');
          }}
          onPersonasChange={() => void refreshPersonas()}
          onClose={() => setPanel('none')}
        />
      )}
    </div>
  );
}
