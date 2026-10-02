'use client';

import { useEffect, useState } from 'react';
import { IconDocument } from '@/components/icons';
import { SidePanel, EmptyState, ErrorState, LoadingState } from '@/components/ui';
import type { Schedule } from '@/lib/schedule';

interface Skill {
  id: string;
  slug: string;
  name: string;
  instructions: string;
}

interface Routine {
  id: string;
  name: string;
  instructions: string;
  schedule: string;
  enabled: number;
  persona_id: string;
}

interface ReviewRule {
  id: string;
  effect: 'require' | 'allow';
  tool: string;
}

interface PersonaOption {
  id: string;
  name: string;
}

const TOOLS = ['workspace_write', 'workspace_delete', 'workspace_shell', 'forget', 'update_artifact', 'workspace_*'];

export function WorkPanel({
  personas,
  activePersonaId,
  onClose,
}: {
  personas: PersonaOption[];
  activePersonaId: string | null;
  onClose: () => void;
}) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [rules, setRules] = useState<ReviewRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [instructions, setInstructions] = useState('');
  const [routineName, setRoutineName] = useState('');
  const [routineInstructions, setRoutineInstructions] = useState('');
  const [everyMinutes, setEveryMinutes] = useState(60);
  const [personaId, setPersonaId] = useState(activePersonaId ?? personas[0]?.id ?? '');

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [skillRes, routineRes, ruleRes] = await Promise.all([
        fetch('/api/skills'),
        fetch('/api/routines'),
        fetch('/api/review-rules'),
      ]);
      if (!skillRes.ok || !routineRes.ok || !ruleRes.ok) throw new Error('Impossible de charger le travail des bots.');
      setSkills(((await skillRes.json()) as { skills: Skill[] }).skills);
      setRoutines(((await routineRes.json()) as { routines: Routine[] }).routines);
      setRules(((await ruleRes.json()) as { rules: ReviewRule[] }).rules);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function addSkill() {
    const res = await fetch('/api/skills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, instructions }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? 'Compétence refusée');
      return;
    }
    setName('');
    setInstructions('');
    await load();
  }

  async function addRoutine() {
    const schedule: Schedule = { kind: 'interval', everyMinutes };
    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personaId,
        name: routineName,
        instructions: routineInstructions,
        schedule,
      }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { error?: string }).error ?? 'Routine refusée');
      return;
    }
    setRoutineName('');
    setRoutineInstructions('');
    await load();
  }

  async function toggleRoutine(routine: Routine) {
    await fetch(`/api/routines/${routine.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: routine.enabled !== 1 }),
    });
    await load();
  }

  async function addRule(effect: 'require' | 'allow', tool: string) {
    const next = [...rules, { id: `${effect}-${tool}-${rules.length}`, effect, tool }];
    const res = await fetch('/api/review-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: next }),
    });
    if (res.ok) setRules(((await res.json()) as { rules: ReviewRule[] }).rules);
  }

  async function removeRule(id: string) {
    const next = rules.filter((rule) => rule.id !== id);
    const res = await fetch('/api/review-rules', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rules: next }),
    });
    if (res.ok) setRules(((await res.json()) as { rules: ReviewRule[] }).rules);
  }

  return (
    <SidePanel title="Travail" icon={<IconDocument className="h-4 w-4" />} onClose={onClose}>
      {loading ? (
        <LoadingState label="Chargement du travail" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto p-4 text-sm">
          <section>
            <h2 className="mb-2 font-medium">Compétences</h2>
            <p className="mb-2 text-xs text-[var(--muted)]">Invoque une compétence avec /raccourci dans le message.</p>
            {skills.length === 0 ? (
              <EmptyState title="Aucune compétence" description="Une compétence décrit comment refaire une tâche." />
            ) : (
              <ul className="space-y-2">
                {skills.map((skill) => (
                  <li key={skill.id} className="card p-2.5">
                    <div className="font-medium">/{skill.slug}</div>
                    <div className="text-xs text-[var(--muted)]">{skill.name}</div>
                    <button
                      type="button"
                      className="btn mt-2 px-2 py-1 text-[11px]"
                      onClick={() => void fetch(`/api/skills/${skill.id}`, { method: 'DELETE' }).then(load)}
                    >
                      Retirer
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <input className="field mt-3 w-full" placeholder="Nom" value={name} onChange={(event) => setName(event.target.value)} aria-label="Nom de la compétence" />
            <textarea className="field mt-2 w-full" rows={3} placeholder="Instructions" value={instructions} onChange={(event) => setInstructions(event.target.value)} aria-label="Instructions de la compétence" />
            <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => void addSkill()} disabled={!name.trim() || !instructions.trim()}>
              Ajouter la compétence
            </button>
          </section>

          <section>
            <h2 className="mb-2 font-medium">Routines</h2>
            <p className="mb-2 text-xs text-[var(--muted)]">Une routine lance un bot à intervalle régulier tant que l’onglet est ouvert. Un cron peut appeler POST /api/routines/tick.</p>
            {routines.length === 0 ? (
              <EmptyState title="Aucune routine" description="Planifie un travail répété pour un bot." />
            ) : (
              <ul className="space-y-2">
                {routines.map((routine) => (
                  <li key={routine.id} className="card p-2.5">
                    <div className="font-medium">{routine.name}</div>
                    <div className="text-xs text-[var(--muted)]">{routine.enabled ? 'active' : 'en pause'}</div>
                    <button type="button" className="btn mt-2 px-2 py-1 text-[11px]" onClick={() => void toggleRoutine(routine)}>
                      {routine.enabled ? 'Pause' : 'Reprendre'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <select className="field mt-3 w-full" value={personaId} onChange={(event) => setPersonaId(event.target.value)} aria-label="Bot de la routine">
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>{persona.name}</option>
              ))}
            </select>
            <input className="field mt-2 w-full" placeholder="Nom de la routine" value={routineName} onChange={(event) => setRoutineName(event.target.value)} aria-label="Nom de la routine" />
            <textarea className="field mt-2 w-full" rows={3} placeholder="Ce que le bot doit faire" value={routineInstructions} onChange={(event) => setRoutineInstructions(event.target.value)} aria-label="Instructions de la routine" />
            <label className="mt-2 block text-xs text-[var(--muted)]">
              Toutes les
              <input className="field mx-2 w-20" type="number" min={1} max={10080} value={everyMinutes} onChange={(event) => setEveryMinutes(Number(event.target.value))} aria-label="Intervalle en minutes" />
              minutes
            </label>
            <button type="button" className="btn btn-primary mt-2 w-full" onClick={() => void addRoutine()} disabled={!personaId || !routineName.trim() || !routineInstructions.trim()}>
              Planifier
            </button>
          </section>

          <section>
            <h2 className="mb-2 font-medium">Auto-revue</h2>
            <p className="mb-2 text-xs text-[var(--muted)]">Une règle « exiger » bloque l’action. Une règle « autoriser » la laisse passer. Exiger l’emporte.</p>
            <ul className="space-y-2">
              {rules.map((rule) => (
                <li key={rule.id} className="card flex items-center justify-between p-2.5">
                  <span>{rule.effect === 'require' ? 'Exiger' : 'Autoriser'} {rule.tool}</span>
                  <button type="button" className="btn px-2 py-1 text-[11px]" onClick={() => void removeRule(rule.id)}>Retirer</button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex flex-wrap gap-2">
              {TOOLS.map((tool) => (
                <button key={tool} type="button" className="chip" onClick={() => void addRule('require', tool)}>
                  Exiger {tool}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </SidePanel>
  );
}
