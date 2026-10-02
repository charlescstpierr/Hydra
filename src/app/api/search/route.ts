import { searchMessages } from '@/lib/agent-store';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return Response.json({ hits: searchMessages(q) });
}
