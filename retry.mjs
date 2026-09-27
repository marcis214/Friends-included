import { getTransactions, notify, parse, reply, syncSheet, updateTransaction } from './_lib.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try { const { reference, target, message } = await parse(req), tx = (await getTransactions()).find((item) => item.reference === reference); if (!tx) throw new Error('Transaction not found.');
    if (target === 'sheet') { const sheet = await syncSheet(tx); await updateTransaction(reference, { sheet_sync_status: sheet.status, sheet_sync_error: null }); return reply(res, 200, { status: sheet.status }); }
    const status = await notify(tx.telegramChatId, message || `Decision for ${reference} is available.`); await updateTransaction(reference, { notification_status: status.status, notification_error: null }); return reply(res, 200, { status: status.status });
  } catch (error) { return reply(res, 400, { error: error.message }); }
}
