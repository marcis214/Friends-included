import { assertSubmission, getEmployees, getTransactions, insertTransaction, parse, reply, syncSheet, updateTransaction } from './_lib.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const tx = await parse(req), actor = (await getEmployees()).find((employee) => employee.id === tx.submittedBy);
    if (!actor) throw new Error('Choose a valid demonstration role.');
    assertSubmission(tx, actor);
    if ((await getTransactions()).some((item) => item.reference.toLowerCase() === tx.reference.toLowerCase())) return reply(res, 409, { error: 'That reference already exists.' });
    tx.submittedAt = new Date().toISOString(); tx.source = tx.source || 'website'; tx.status = tx.type === 'sale' ? 'pending' : tx.payload.proposedAllocation === 'Company overhead' ? 'overhead' : 'awaiting_allocation';
    if (tx.status === 'overhead') tx.decision = { finalAllocation: 'Company overhead' };
    await insertTransaction(tx);
    try { const sheet = await syncSheet(tx); await updateTransaction(tx.reference, { sheet_sync_status: sheet.status, sheet_sync_error: null }); } catch (error) { await updateTransaction(tx.reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message }); }
    return reply(res, 201, { transaction: tx, confirmation: `${tx.reference} saved for ${Number(tx.payload.amount).toFixed(2)}. Status: ${tx.status.replace('_', ' ')}.` });
  } catch (error) { return reply(res, 400, { error: error.message }); }
}
