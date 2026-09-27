import { commissionAmounts, getEmployees, getTransactions, money, notify, parse, reply, splitValid, syncSheet, updateTransaction } from './_lib.mjs';
export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const action = await parse(req), actor = (await getEmployees()).find((employee) => employee.id === action.actorId);
    if (!actor || actor.role !== 'manager') return reply(res, 403, { error: 'Only Svetlana can approve or correct transactions.' });
    const tx = (await getTransactions()).find((item) => item.reference === action.reference);
    if (!tx) throw new Error('Transaction not found.');
    if (tx.status === 'approved' || tx.status === 'allocated' || tx.status === 'overhead') return reply(res, 409, { error: 'This transaction is already decided; totals are unchanged.' });
    let notification;
    if (tx.type === 'sale') {
      if (!splitValid(action.approvedSplit)) throw new Error('Final commission shares must total 100%.');
      const amounts = commissionAmounts(tx.payload.amount, action.approvedSplit), changed = tx.payload.proposedSplit.some((n, i) => Number(n) !== Number(action.approvedSplit[i]));
      tx.status = 'approved'; tx.decision = { approvedSplit: action.approvedSplit.map(Number), decidedAt: new Date().toISOString(), decidedBy: actor.id };
      notification = `Sale ${tx.reference} approved${changed ? ' — commission split changed' : ''}. Sale ${money(tx.payload.amount)}; total commission ${money(amounts.pool)}. Richard: ${action.approvedSplit[0]}% (${money(amounts.amounts[0])}). Anastasia: ${action.approvedSplit[1]}% (${money(amounts.amounts[1])}). Jean-Claude: ${action.approvedSplit[2]}% (${money(amounts.amounts[2])}).`;
    } else {
      if (!['A','B','Company overhead'].includes(action.finalAllocation)) throw new Error('Choose A, B, or Company overhead.');
      tx.status = action.finalAllocation === 'Company overhead' ? 'overhead' : 'allocated'; tx.decision = { finalAllocation: action.finalAllocation, decidedAt: new Date().toISOString(), decidedBy: actor.id };
      notification = `Expense ${tx.reference}: ${money(tx.payload.amount)} ${tx.payload.description}. Proposed: ${tx.payload.proposedAllocation}. Approved: ${action.finalAllocation}.`;
    }
    await updateTransaction(tx.reference, { status: tx.status, decision: tx.decision });
    try { const sheet = await syncSheet(tx); await updateTransaction(tx.reference, { sheet_sync_status: sheet.status, sheet_sync_error: null }); } catch (error) { await updateTransaction(tx.reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message }); }
    const sender = (await getEmployees()).find((employee) => employee.id === tx.submittedBy);
    const recipient = tx.telegramChatId || sender?.telegram_chat_id;
    try { const result = await notify(recipient, notification); await updateTransaction(tx.reference, { notification_status: result.status, notification_error: null }); } catch (error) { await updateTransaction(tx.reference, { notification_status: 'failed', notification_error: error.message }); }
    return reply(res, 200, { transaction: tx, notification });
  } catch (error) { return reply(res, 400, { error: error.message }); }
}
