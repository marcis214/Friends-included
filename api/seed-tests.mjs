import { completedTests, configured, getEmployees, getTransactions, insertTransaction, parse, reply, syncSheet, updateTransaction } from './_lib.mjs';

function sameFixture(saved, fixture) {
  if (saved.type !== fixture.type || saved.submittedBy !== fixture.submittedBy || saved.status !== fixture.status) return false;
  const payload = saved.payload || {}, expected = fixture.payload;
  if (Number(payload.amount) !== Number(expected.amount)) return false;
  if (fixture.type === 'sale') return payload.customer === expected.customer && payload.project === expected.project && payload.description === expected.description && JSON.stringify(payload.proposedSplit) === JSON.stringify(expected.proposedSplit) && JSON.stringify(saved.decision?.approvedSplit || null) === JSON.stringify(fixture.decision?.approvedSplit || null);
  return payload.description === expected.description && payload.category === expected.category && payload.proposedAllocation === expected.proposedAllocation && saved.decision?.finalAllocation === fixture.decision?.finalAllocation;
}

function practiceReference(existing) {
  for (let number = 5; number < 1000; number += 1) {
    const reference = `P${String(number).padStart(2, '0')}`;
    if (!existing.has(reference.toLowerCase())) return reference;
  }
  throw new Error('Could not create a separate practice reference.');
}

async function markSheetResult(reference, work) {
  try {
    const sheet = await work();
    await updateTransaction(reference, { sheet_sync_status: sheet.status, sheet_sync_error: null });
    return null;
  } catch (error) {
    await updateTransaction(reference, { sheet_sync_status: 'failed', sheet_sync_error: error.message });
    return reference;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const { actorId } = await parse(req);
    const actor = (await getEmployees()).find((employee) => employee.id === actorId);
    if (!actor || actor.role !== 'manager') return reply(res, 403, { error: 'Only Svetlana can load the coursework test data.' });
    if (!configured()) return reply(res, 400, { error: 'Connect Supabase before loading persistent test data.' });

    const existing = new Map((await getTransactions()).map((transaction) => [transaction.reference.toLowerCase(), transaction]));
    const inserted = [], alreadyPresent = [], repaired = [], sheetFailures = [];

    for (const fixture of completedTests) {
      const key = fixture.reference.toLowerCase(), saved = existing.get(key);
      if (saved && sameFixture(saved, fixture)) {
        if (saved.payload?.courseworkFixture !== true) await updateTransaction(saved.reference, { payload: { ...saved.payload, courseworkFixture: true, practiceRecord: false } });
        alreadyPresent.push(fixture.reference);
        continue;
      }

      if (saved) {
        // Preserve an accidental practice record under a new reference, then
        // restore the exact assignment fixture at its required reference.
        const newReference = practiceReference(existing);
        const { courseworkFixture, ...payload } = saved.payload || {};
        const practice = { ...saved, reference: newReference, payload: { ...payload, practiceRecord: true, practiceNote: `Moved from ${saved.reference} to keep the required ${fixture.reference} fixture separate.` } };
        await updateTransaction(saved.reference, { reference: newReference, payload: practice.payload });
        const failure = await markSheetResult(newReference, () => syncSheet(practice, saved.reference));
        if (failure) sheetFailures.push(failure);
        existing.delete(key);
        existing.set(newReference.toLowerCase(), practice);
        repaired.push(`${saved.reference} → ${newReference}`);
      }

      const transaction = { ...fixture, source: 'website', telegramChatId: null, payload: { ...fixture.payload, courseworkFixture: true, practiceRecord: false }, submittedAt: new Date().toISOString() };
      try {
        await insertTransaction(transaction);
      } catch (error) {
        if (/23505|duplicate key/i.test(error.message)) { alreadyPresent.push(transaction.reference); continue; }
        throw error;
      }
      existing.set(key, transaction);
      inserted.push(transaction.reference);
      const failure = await markSheetResult(transaction.reference, () => syncSheet(transaction));
      if (failure) sheetFailures.push(failure);
    }

    const parts = [];
    if (inserted.length) parts.push(`Loaded ${inserted.length} missing coursework records: ${inserted.join(', ')}.`);
    if (repaired.length) parts.push(`Moved mismatched practice record(s): ${repaired.join(', ')}. The original assignment record has been restored.`);
    if (alreadyPresent.length) parts.push(`Already correct: ${alreadyPresent.join(', ')}.`);
    if (!parts.length) parts.push('All required coursework records are already loaded; nothing was duplicated.');
    if (sheetFailures.length) parts.push(`Google Sheets needs a retry for: ${sheetFailures.join(', ')}.`);
    return reply(res, 200, { confirmation: parts.join(' ') });
  } catch (error) {
    return reply(res, 400, { error: error.message });
  }
}
