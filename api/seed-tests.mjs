import { completedTests, configured, getEmployees, getTransactions, insertTransaction, parse, reply, syncSheet, updateTransaction } from './_lib.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const { actorId } = await parse(req);
    const actor = (await getEmployees()).find((employee) => employee.id === actorId);
    if (!actor || actor.role !== 'manager') return reply(res, 403, { error: 'Only Svetlana can load the coursework test data.' });
    if (!configured()) return reply(res, 400, { error: 'Connect Supabase before loading persistent test data.' });

    const existing = new Set((await getTransactions()).map((transaction) => transaction.reference.toLowerCase()));
    const inserted = [];
    const sheetFailures = [];

    for (const fixture of completedTests) {
      if (existing.has(fixture.reference.toLowerCase())) continue;
      const transaction = {
        ...fixture,
        source: 'website',
        telegramChatId: null,
        payload: { ...fixture.payload, courseworkFixture: true },
        submittedAt: new Date().toISOString()
      };
      await insertTransaction(transaction);
      inserted.push(transaction.reference);
      try {
        const sheet = await syncSheet(transaction);
        await updateTransaction(transaction.reference, { sheet_sync_status: sheet.status, sheet_sync_error: null });
      } catch (error) {
        sheetFailures.push(transaction.reference);
        await updateTransaction(transaction.reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message });
      }
    }

    const message = inserted.length
      ? `Loaded ${inserted.length} missing coursework records: ${inserted.join(', ')}.`
      : 'All required coursework records are already loaded; nothing was duplicated.';
    return reply(res, 200, { confirmation: sheetFailures.length ? `${message} Google Sheets needs a retry for: ${sheetFailures.join(', ')}.` : message });
  } catch (error) {
    return reply(res, 400, { error: error.message });
  }
}
