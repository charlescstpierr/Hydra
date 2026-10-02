import { loadReviewRules, saveReviewRules } from '@/lib/agent-store';
import { parseReviewRules } from '@/lib/review-rules';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ rules: loadReviewRules() });
}

export async function PUT(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { rules?: unknown };
  const rules = saveReviewRules(parseReviewRules(body.rules));
  return Response.json({ rules });
}
