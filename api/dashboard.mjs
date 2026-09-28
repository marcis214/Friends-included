import { calculate, completedTests, courseworkFixtureReferences, getEmployees, getTransactions, configured, originalControlTotals, reply } from './_lib.mjs';

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
    const live = configured(), transactions = await getTransactions();
    const fixtureTransactions = live ? transactions.filter((transaction) => transaction.payload?.courseworkFixture === true) : completedTests;
    const loaded = new Set(fixtureTransactions.map((transaction) => transaction.reference));
    return reply(res, 200, {
      mode: live ? 'live' : 'demo',
      employees: await getEmployees(),
      transactions,
      financials: calculate(transactions),
      testing: {
        originalControlTotals,
        expected: calculate(completedTests),
        actual: calculate(fixtureTransactions),
        requiredReferences: courseworkFixtureReferences,
        missingReferences: courseworkFixtureReferences.filter((reference) => !loaded.has(reference))
      },
      links: safeLinks()
    });
  }
  catch (error) { return reply(res, 500, { error: error.message }); }
}
