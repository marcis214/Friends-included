import { assertSubmission, getEmployees, getTransactions, insertTransaction, notify, reply, syncSheet, updateTransaction } from './_lib.mjs';
const help = 'Send /sale REF|Customer|A or B|Description|Amount|Richard%|Anastasia%|Jean-Claude% or /expense REF|Description|Materials Travel or Other|Amount|A B or Company overhead';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  if (process.env.TELEGRAM_WEBHOOK_SECRET && req.query?.secret !== process.env.TELEGRAM_WEBHOOK_SECRET) return reply(res, 401, { error: 'Unauthorized' });
  try { const message = req.body?.message; if (!message?.text) return reply(res, 200, { ok: true }); const text = message.text.trim();
    if (text === '/start') { await notify(message.chat.id, 'Friends Included is ready. Ask Svetlana to link your Telegram user ID before submitting. ' + help); return reply(res, 200, { ok: true }); }
    const sender = (await getEmployees()).find((e) => String(e.telegram_user_id) === String(message.from.id));
    if (!sender) { await notify(message.chat.id, 'Your Telegram account is not linked to a fictional employee. Ask Svetlana to link it in Manager setup.'); return reply(res, 200, { ok: true }); }
    const [command, rest] = text.split(/\s+/, 2), fields = rest?.split('|').map((v) => v.trim()); let tx;
    if (command === '/sale' && fields?.length === 8) tx = { reference: fields[0], type: 'sale', submittedBy: sender.id, payload: { customer: fields[1], project: fields[2], description: fields[3], amount: Number(fields[4]), proposedSplit: fields.slice(5).map(Number) } };
    else if (command === '/expense' && fields?.length === 5) tx = { reference: fields[0], type: 'expense', submittedBy: sender.id, payload: { description: fields[1], category: fields[2], amount: Number(fields[3]), proposedAllocation: fields[4] } };
    else { await notify(message.chat.id, 'I could not read that submission. ' + help); return reply(res, 200, { ok: true }); }
    assertSubmission(tx, sender); if ((await getTransactions()).some((item) => item.reference.toLowerCase() === tx.reference.toLowerCase())) throw new Error('That reference already exists.');
    tx.source = 'telegram'; tx.telegramChatId = String(message.chat.id); tx.submittedAt = new Date().toISOString(); tx.status = tx.type === 'sale' ? 'pending' : tx.payload.proposedAllocation === 'Company overhead' ? 'overhead' : 'awaiting_allocation'; if (tx.status === 'overhead') tx.decision = { finalAllocation: 'Company overhead' };
    await insertTransaction(tx); try { const sheet = await syncSheet(tx); await updateTransaction(tx.reference, { sheet_sync_status: sheet.status }); } catch (error) { await updateTransaction(tx.reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message }); }
    await notify(message.chat.id, `${tx.reference} saved: €${Number(tx.payload.amount).toFixed(2)}. ${tx.type === 'sale' ? `Project ${tx.payload.project}` : `Proposed allocation ${tx.payload.proposedAllocation}`}. Status: ${tx.status.replace('_', ' ')}.`); return reply(res, 200, { ok: true });
  } catch (error) { try { await notify(req.body?.message?.chat?.id, `Not saved: ${error.message}`); } catch {} return reply(res, 200, { ok: true }); }
}
