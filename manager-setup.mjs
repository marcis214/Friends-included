import { getEmployees, parse, reply, supabase, configured } from './_lib.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try { const { actorId, employeeId, telegramUserId, telegramChatId } = await parse(req); const actor = (await getEmployees()).find((e) => e.id === actorId); if (!actor || actor.role !== 'manager') return reply(res, 403, { error: 'Only Svetlana can link Telegram accounts.' }); if (!configured()) return reply(res, 400, { error: 'Connect Supabase before saving a Telegram link.' });
    await supabase(`employees?id=eq.${encodeURIComponent(employeeId)}`, { method: 'PATCH', body: JSON.stringify({ telegram_user_id: String(telegramUserId), telegram_chat_id: String(telegramChatId || '') }) }); return reply(res, 200, { ok: true });
  } catch (error) { return reply(res, 400, { error: error.message }); }
}
