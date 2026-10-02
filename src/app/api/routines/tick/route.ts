import { deliverDueReminders, runDueRoutines } from '@/lib/routines';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST() {
  const reminders = await deliverDueReminders();
  const routines = await runDueRoutines();
  return Response.json({ reminders, routines });
}
