import { assertSubmission, getEmployees, getTransactions, insertTransaction, notify, reply, syncSheet, updateTransaction } from './_lib.mjs';

const help = 'Send /sale REF | Customer | A or B | Description | Amount | Richard% | Anastasia% | Jean-Claude%. Spaces around | and spaces in names or descriptions are accepted. For an expense, send /expense REF | Description | Materials, Travel, or Other | Amount | A, B, or Company overhead.';

export function parseTelegramSubmission(text, senderId) {
  const match = String(text || '').trim().match(/^\/(sale|expense)(?:@\w+)?\s+(.+)$/i);
  if (!match) return null;
  const command = match[1].toLowerCase(), fields = match[2].split('|').map((value) => value.trim());
  if (command === 'sale' && fields.length === 8) {
    return { reference: fields[0], type: 'sale', submittedBy: senderId, payload: { customer: fields[1], project: fields[2], description: fields[3], amount: Number(fields[4]), proposedSplit: fields.slice(5).map(Number) } };
  }
  if (command === 'expense' && fields.length === 5) {
    return { reference: fields[0], type: 'expense', submittedBy: senderId, payload: { description: fields[1], category: fields[2], amount: Number(fields[3]), proposedAllocation: fields[4] } };
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  if (process.env.TELEGRAM_WEBHOOK_SECRET && req.query?.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return reply(res, 401, { error: 'Unauthorized' });
  try {
    const message = req.body?.message;
    if (!message?.text) return reply(res, 200, { ok: true });
    const text = message.text.trim();
    if (/^\/start(?:@\w+)?$/i.test(text)) {
      await notify(message.chat.id, 'Friends Included is ready. Ask Svetlana to link your Telegram user ID before submitting. ' + help);
      return reply(res, 200, { ok: true });
    }
    const sender = (await getEmployees()).find((employee) => String(employee.telegram_user_id) === String(message.from.id));
    if (!sender) {
      await notify(message.chat.id, 'Your Telegram account is not linked to a fictional employee. Ask Svetlana to link it in Manager setup.');
      return reply(res, 200, { ok: true });
    }
    const transaction = parseTelegramSubmission(text, sender.id);
    if (!transaction) {
      await notify(message.chat.id, 'I could not read that submission. ' + help);
      return reply(res, 200, { ok: true });
    }
    assertSubmission(transaction, sender);
    if ((await getTransactions()).some((item) => item.reference.toLowerCase() === transaction.reference.toLowerCase())) throw new Error('That reference already exists.');
    transaction.source = 'telegram';
    transaction.telegramChatId = String(message.chat.id);
    transaction.submittedAt = new Date().toISOString();
    transaction.status = transaction.type === 'sale' ? 'pending' : transaction.payload.proposedAllocation === 'Company overhead' ? 'overhead' : 'awaiting_allocation';
    if (transaction.status === 'overhead') transaction.decision = { finalAllocation: 'Company overhead' };
    await insertTransaction(transaction);
    try {
      const sheet = await syncSheet(transaction);
      await updateTransaction(transaction.reference, { sheet_sync_status: sheet.status, sheet_sync_error: null });
    } catch (error) {
      await updateTransaction(transaction.reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message });
    }
    await notify(message.chat.id, `${transaction.reference} saved: €${Number(transaction.payload.amount).toFixed(2)}. ${transaction.type === 'sale' ? `Project ${transaction.payload.project}` : `Proposed allocation ${transaction.payload.proposedAllocation}`}. Status: ${transaction.status.replace('_', ' ')}.`);
    return reply(res, 200, { ok: true });
  } catch (error) {
    try { await notify(req.body?.message?.chat?.id, `Not saved: ${error.message}`); } catch {}
    return reply(res, 200, { ok: true });
  }
}
