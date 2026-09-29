import { getEmployees, parse, reply, supabase, configured } from './_lib.mjs';

const clearLink = (employeeId) => supabase(`employees?id=eq.${encodeURIComponent(employeeId)}`, {
  method: 'PATCH',
  body: JSON.stringify({ telegram_user_id: null, telegram_chat_id: null })
});

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const { actorId, employeeId, telegramUserId, telegramChatId, action = 'link' } = await parse(req);
    const staff = await getEmployees();
    const actor = staff.find((employee) => employee.id === actorId);
    const target = staff.find((employee) => employee.id === employeeId);
    if (!actor || actor.role !== 'manager') return reply(res, 403, { error: 'Only Svetlana can manage fictional Telegram links.' });
    if (!target || target.role === 'manager') return reply(res, 400, { error: 'Choose one of the fictional employees.' });
    if (!configured()) return reply(res, 400, { error: 'Connect Supabase before saving a Telegram link.' });

    if (action === 'unlink') {
      await clearLink(target.id);
      return reply(res, 200, { ok: true, confirmation: `${target.name} is unlinked. Existing transaction notification chats were not changed.` });
    }

    const userId = String(telegramUserId || '').trim();
    const chatId = String(telegramChatId || '').trim();
    if (!userId || !chatId) return reply(res, 400, { error: 'Enter the fictional Telegram user ID and chat ID first.' });
    const conflicts = staff.filter((employee) => employee.id !== target.id && (employee.telegram_user_id === userId || employee.telegram_chat_id === chatId));
    if (action === 'link' && conflicts.length) {
      return reply(res, 409, { error: `This test account is already linked to ${conflicts.map((employee) => employee.name).join(', ')}. Use “Move/reassign test binding” to move it safely.` });
    }
    if (action !== 'link' && action !== 'reassign') return reply(res, 400, { error: 'Unknown link action.' });

    // Only employee links are changed. Telegram-created transactions retain their
    // own stored chat ID, so past approval messages continue to reach that chat.
    if (action === 'reassign') await Promise.all(conflicts.map((employee) => clearLink(employee.id)));
    await supabase(`employees?id=eq.${encodeURIComponent(target.id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ telegram_user_id: userId, telegram_chat_id: chatId })
    });
    const moved = conflicts.length ? ` Moved the fictional test binding from ${conflicts.map((employee) => employee.name).join(', ')}.` : '';
    return reply(res, 200, { ok: true, confirmation: `${target.name} is linked for Telegram testing.${moved} Existing transaction notification chats were not changed.` });
  } catch (error) { return reply(res, 400, { error: error.message }); }
}
