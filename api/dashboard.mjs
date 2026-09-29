import { calculate, completedTests, courseworkFixtureReferences, getEmployees, getTransactions, configured, originalControlTotals, reply } from './_lib.mjs';

// A demonstration role is still not a real login, but the server must not hand
// every browser the complete ledger or Telegram account links.
export const publicEmployee = ({ id, name, role }) => ({ id, name, role });
export const publicTransaction = ({ reference, type, submittedBy, submittedAt, source, status, payload, decision, sheetSyncStatus, sheetSyncError, notificationStatus, notificationError }) => ({
  reference, type, submittedBy, submittedAt, source, status, payload, decision,
  sheetSyncStatus, sheetSyncError, notificationStatus, notificationError
});

export function dashboardScope(employees, transactions, actorId) {
  const actor = employees.find((employee) => employee.id === actorId) || null;
  if (!actor) return { actor: null, isManager: false, transactions: [] };
  return {
    actor,
    isManager: actor.role === 'manager',
    transactions: actor.role === 'manager' ? transactions : transactions.filter((transaction) => transaction.submittedBy === actor.id)
  };
}

function safeLinks() {
  const bot = String(process.env.TELEGRAM_BOT_URL || '').trim();
  return {
    github: String(process.env.GITHUB_REPOSITORY_URL || 'https://github.com/marcis214/Friends-included').trim(),
    googleSheet: process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/edit?usp=sharing` : null,
    telegram: bot ? (bot.startsWith('http') ? bot : `https://t.me/${bot.replace(/^@/, '')}`) : null
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return reply(res, 405, { error: 'Method not allowed' });
  try {
    const live = configured();
    const [employees, allTransactions] = await Promise.all([getEmployees(), getTransactions()]);
    const scope = dashboardScope(employees, allTransactions, String(req.query?.actorId || ''));
    const fixtureTransactions = live ? allTransactions.filter((transaction) => transaction.payload?.courseworkFixture === true) : completedTests;
    const loaded = new Set(fixtureTransactions.map((transaction) => transaction.reference));
    return reply(res, 200, {
      mode: live ? 'live' : 'demo',
      actor: scope.actor ? publicEmployee(scope.actor) : null,
      manager: scope.isManager,
      employees: employees.map(publicEmployee),
      transactions: scope.transactions.map(publicTransaction),
      financials: scope.isManager ? calculate(allTransactions) : null,
      testing: scope.isManager ? {
        originalControlTotals,
        expected: calculate(completedTests),
        actual: calculate(fixtureTransactions),
        requiredReferences: courseworkFixtureReferences,
        missingReferences: courseworkFixtureReferences.filter((reference) => !loaded.has(reference))
      } : null,
      links: safeLinks()
    });
  }
  catch (error) { return reply(res, 500, { error: error.message }); }
}
