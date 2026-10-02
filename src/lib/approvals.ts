import { executeAction } from './actions';
import { claimApproval, getApproval, insertActivity, settleApproval, type Approval } from './agent-store';

export async function resolveApproval(id: string, decision: 'approve' | 'reject'): Promise<Approval> {
  const existing = getApproval(id);
  if (!existing) throw new Error('Approbation introuvable');
  if (existing.status === 'approved' || existing.status === 'rejected') return existing;

  if (decision === 'reject') {
    const settled = settleApproval(id, 'rejected', { rejected: true });
    if (!settled) throw new Error('Approbation introuvable');
    insertActivity({
      conversationId: settled.conversation_id,
      kind: 'approval',
      name: settled.tool,
      detail: 'refusée',
    });
    return settled;
  }

  const { approval: claimed, claimed: won } = claimApproval(id);
  if (!claimed) throw new Error('Approbation introuvable');
  if (!won) return claimed;

  try {
    const result = await executeAction(claimed.tool, JSON.parse(claimed.input_json), {
      conversationId: claimed.conversation_id,
    });
    const settled = settleApproval(id, 'approved', result);
    if (!settled) throw new Error('Approbation introuvable');
    insertActivity({
      conversationId: settled.conversation_id,
      kind: 'approval',
      name: settled.tool,
      detail: 'approuvée',
    });
    return settled;
  } catch (error) {
    const settled = settleApproval(id, 'failed', { error: (error as Error).message });
    if (!settled) throw error;
    return settled;
  }
}
