'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LibraryPanel } from '@/components/library-panel';
import { Markdown } from '@/components/markdown';
import { MemoryPanel } from '@/components/memory-panel';
import { PersonaPanel } from '@/components/persona-panel';
import { RemindersPanel } from '@/components/reminders-panel';
import { DEFAULT_VOICE_SETTINGS, VoicePanel, type VoiceSettings } from '@/components/voice-panel';
import type { Attachment, Conversation, Memory, Message, Persona } from '@/lib/db';
import type { ModelInfo } from '@/lib/models';
import { readEventStream } from '@/lib/sse';
import type { VoiceInfo } from '@/lib/voice';

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
  web_search: '🌐 recherche web',
  create_image: '🎨 génération d’image',
  create_artifact: '📄 création d’artefact',
  create_podcast: '🎧 production audio',
  set_reminder: '⏰ rappel programmé',
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
    'none' | 'memory' | 'persona' | 'voice' | 'reminders' | 'library'
  >('none');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [recording, setRecording] = useState(false);

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
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = (await res.json()) as {
      conversation: Conversation;
      messages: Message[];
      memories: Memory[];
      attachments: Attachment[];
      sideChats: Conversation[];
    };
    setConversation(data.conversation);
    setMessages(data.messages);
    setMemories(data.memories);
    setAttachments(data.attachments);
    setSideChats(data.sideChats);
    setLiveText('');
    setLiveReasoning('');
    setToolEvents([]);
    if (data.conversation.default_model) setModelId(data.conversation.default_model);
  }, []);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/models');
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

  async function newConversation(options?: { personaId?: string | null; parentId?: string | null }) {
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        defaultModel: modelId || undefined,
        personaId: options?.personaId ?? null,
        parentId: options?.parentId ?? null,
        title: options?.parentId ? 'Fil parallèle' : undefined,
      }),
    });
    const { conversation: created } = (await res.json()) as { conversation: Conversation };
    await refreshConversations();
    setConversation(created);
    setMessages([]);
    setAttachments([]);
    setMemories([]);
    setPending([]);
    setSideChats([]);
    return created;
  }

  async function removeConversation(id: string) {
    await fetch(`/api/conversations/${id}`, { method: 'DELETE' });
    const list = await refreshConversations();
    if (conversation?.id === id) {
      if (list.length > 0) await openConversation(list[0].id);
      else {
        setConversation(null);
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

  return (
    <div className="flex h-full">
      {sidebarOpen && (
        <aside className="flex w-72 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
          <div className="flex items-center justify-between px-4 py-4">
            <span className="text-lg font-semibold tracking-tight">🐍 Hydra</span>
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-[var(--surface-2)]"
            >
              ✕
            </button>
          </div>
          <button
            onClick={() => void newConversation({ personaId: conversation?.persona_id ?? null })}
            className="mx-3 mb-3 rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            + Nouvelle conversation
          </button>
          <div className="flex-1 overflow-y-auto px-2">
            {conversations.map((item) => (
              <div
                key={item.id}
                className={`group flex items-center gap-1 rounded-lg px-2 ${
                  item.parent_id ? 'ml-4 border-l border-[var(--border)]' : ''
                } ${
                  conversation?.id === item.id ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface-2)]'
                }`}
              >
                <button
                  onClick={() => void openConversation(item.id)}
                  className="flex-1 truncate py-2 text-left text-sm"
                  title={item.title}
                >
                  {item.parent_id ? '↳ ' : ''}
                  {item.title}
                </button>
                <button
                  onClick={() => void removeConversation(item.id)}
                  className="invisible px-1 text-xs text-[var(--muted)] group-hover:visible hover:text-red-400"
                  title="Supprimer"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
          <div className="space-y-1 border-t border-[var(--border)] p-3 text-sm">
            <button
              onClick={() => setPanel(panel === 'persona' ? 'none' : 'persona')}
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)]"
            >
              🎭 Personas
            </button>
            <button
              onClick={() => setPanel(panel === 'memory' ? 'none' : 'memory')}
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)]"
            >
              🧠 Mémoire
            </button>
            {capabilities.voice && (
              <button
                onClick={() => setPanel(panel === 'voice' ? 'none' : 'voice')}
                className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)]"
              >
                🔊 Voix
              </button>
            )}
            <button
              onClick={() => setPanel(panel === 'reminders' ? 'none' : 'reminders')}
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)]"
            >
              ⏰ Rappels
            </button>
            <button
              onClick={() => setPanel(panel === 'library' ? 'none' : 'library')}
              className="w-full rounded-lg px-2 py-2 text-left hover:bg-[var(--surface-2)]"
            >
              📚 Bibliothèque
            </button>
          </div>
        </aside>
      )}

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          {!sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-md px-2 py-1 text-sm hover:bg-[var(--surface-2)]"
            >
              ☰
            </button>
          )}
          <select
            value={modelId}
            onChange={(event) => setModelId(event.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm"
          >
            {availableModels.length === 0 && <option value="">Aucun modèle configuré</option>}
            {availableModels.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label} — {model.hint}
              </option>
            ))}
          </select>

          <select
            value={conversation?.persona_id ?? ''}
            onChange={(event) => void setConversationPersona(event.target.value || null)}
            disabled={!conversation}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-sm disabled:opacity-50"
          >
            <option value="">Persona par défaut</option>
            {personas.map((persona) => (
              <option key={persona.id} value={persona.id}>
                {persona.emoji} {persona.name}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={useWeb && capabilities.webSearch}
              disabled={!capabilities.webSearch}
              onChange={(event) => setUseWeb(event.target.checked)}
            />
            🌐 Web
          </label>
          <label className="flex items-center gap-1 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={useImages && capabilities.imageGeneration}
              disabled={!capabilities.imageGeneration}
              onChange={(event) => setUseImages(event.target.checked)}
            />
            🎨 Images
          </label>

          <button
            onClick={() =>
              void newConversation({
                personaId: conversation?.persona_id ?? null,
                parentId: conversation?.parent_id ?? conversation?.id ?? null,
              })
            }
            disabled={!conversation}
            className="rounded-lg border border-[var(--border)] px-2 py-1.5 text-xs hover:bg-[var(--surface-2)] disabled:opacity-40"
            title="Ouvrir un fil parallèle qui partage la mémoire de cette conversation"
          >
            ⤳ Fil parallèle
          </button>

          <div className="ml-auto truncate text-xs text-[var(--muted)]">
            {activePersona ? `${activePersona.emoji} ${activePersona.name}` : 'Hydra'}
          </div>
        </header>

        {(sideChats.length > 0 || conversation?.parent_id) && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-2 text-xs text-[var(--muted)]">
            {conversation?.parent_id && (
              <button
                onClick={() => void openConversation(conversation.parent_id!)}
                className="rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-2)]"
              >
                ↰ Revenir au fil principal
              </button>
            )}
            {sideChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => void openConversation(chat.id)}
                className="rounded-lg border border-[var(--border)] px-2 py-1 hover:bg-[var(--surface-2)]"
              >
                ↳ {chat.title}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 py-6">
            {messages.length === 0 && !streaming && (
              <div className="mt-24 text-center text-[var(--muted)]">
                <p className="text-2xl font-semibold text-[var(--foreground)]">Hydra</p>
                <p className="mt-2 text-sm">
                  Un seul fil, plusieurs têtes : change de modèle en pleine conversation, la
                  mémoire et le persona suivent.
                </p>
              </div>
            )}

            {messages.map((message) => (
              <article key={message.id} className="mb-6">
                <div className="mb-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <span>{message.role === 'user' ? 'Toi' : 'Hydra'}</span>
                  {message.model_id && <span>· {message.model_id}</span>}
                  {message.role === 'assistant' && capabilities.voice && (
                    <button
                      onClick={() => void speak(message.content)}
                      className="hover:text-[var(--foreground)]"
                      title="Lire à voix haute"
                    >
                      🔊
                    </button>
                  )}
                </div>
                {message.reasoning && (
                  <details className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--muted)]">
                    <summary className="cursor-pointer">Raisonnement</summary>
                    <pre className="mt-2 whitespace-pre-wrap">{message.reasoning}</pre>
                  </details>
                )}
                <div
                  className={
                    message.role === 'user'
                      ? 'rounded-2xl bg-[var(--surface-2)] px-4 py-3'
                      : ''
                  }
                >
                  <Markdown>{message.content}</Markdown>
                  <div className="flex flex-wrap gap-2">
                    {attachmentsFor(message.id).map((attachment) =>
                      attachment.media_type.startsWith('image/') ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={attachment.id}
                          src={`/api/files/${attachment.id}`}
                          alt={attachment.name}
                          className="mt-2 max-h-56 rounded-xl border border-[var(--border)]"
                        />
                      ) : (
                        <a
                          key={attachment.id}
                          href={`/api/files/${attachment.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-2 rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                        >
                          📎 {attachment.name}
                        </a>
                      ),
                    )}
                  </div>
                </div>
              </article>
            ))}

            {(liveReasoning || liveText || streaming) && (
              <article className="mb-6">
                <div className="mb-1 text-xs text-[var(--muted)]">Hydra · {modelId}</div>
                {toolEvents.length > 0 && (
                  <div className="mb-2 text-xs text-[var(--muted)]">
                    {toolEvents.map((name, index) => (
                      <span key={index} className="mr-2">
                        {TOOL_LABELS[name] ?? name}…
                      </span>
                    ))}
                  </div>
                )}
                {liveReasoning && (
                  <details open className="mb-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-2 text-xs text-[var(--muted)]">
                    <summary className="cursor-pointer">Raisonnement en cours</summary>
                    <pre className="mt-2 whitespace-pre-wrap">{liveReasoning}</pre>
                  </details>
                )}
                {liveText ? <Markdown>{liveText}</Markdown> : <span className="text-[var(--muted)]">…</span>}
              </article>
            )}

            {error && (
              <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3">
          <div className="mx-auto w-full max-w-3xl">
            {queue.length > 0 && (
              <div className="mb-2 space-y-1 text-xs text-[var(--muted)]">
                {queue.map((text, index) => (
                  <div key={index} className="truncate rounded-lg border border-dashed border-[var(--border)] px-2 py-1">
                    ⏳ en file : {text}
                  </div>
                ))}
              </div>
            )}
            {pending.length > 0 && (
              <div className="mb-2 flex flex-wrap gap-2">
                {pending.map((attachment) => (
                  <span
                    key={attachment.id}
                    className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs"
                  >
                    📎 {attachment.name}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] p-2">
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
                className="rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface)]"
                title="Joindre un fichier"
              >
                📎
              </button>
              {capabilities.voice && (
                <button
                  onClick={() => void toggleRecording()}
                  className={`rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface)] ${recording ? 'text-red-400' : ''}`}
                  title="Dicter"
                >
                  🎙
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
                placeholder="Écris à Hydra…"
                className="max-h-40 min-h-10 flex-1 resize-y bg-transparent px-2 py-2 text-sm outline-none"
              />
              <button
                onClick={regenerate}
                disabled={streaming || messages.length === 0}
                className="rounded-lg px-2 py-2 text-sm hover:bg-[var(--surface)] disabled:opacity-40"
                title="Régénérer la dernière réponse"
              >
                ⟳
              </button>
              <button
                onClick={() => send(draft)}
                disabled={!draft.trim()}
                className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                {streaming ? 'Mettre en file' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      </main>

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
        <PersonaPanel
          personas={personas}
          models={availableModels}
          voices={voices}
          activeId={conversation?.persona_id ?? null}
          onClose={() => setPanel('none')}
          onSelect={(id) => void setConversationPersona(id)}
          onChange={refreshPersonas}
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
        <RemindersPanel
          conversationId={conversation?.id ?? null}
          onClose={() => setPanel('none')}
        />
      )}
      {panel === 'library' && <LibraryPanel onClose={() => setPanel('none')} />}
    </div>
  );
}
