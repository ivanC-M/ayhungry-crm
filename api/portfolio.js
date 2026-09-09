const { isAuthenticated } = require('../lib/require-auth');
const { getClient, queryAllPages } = require('../lib/notion-client');
const { mapPageToRecord } = require('../lib/notion-map');
const { buildPortfolio } = require('../lib/portfolio');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const client = getClient();
  const pages = await queryAllPages(client, process.env.NOTION_DATABASE_ID);
  const records = pages.map(mapPageToRecord);
  const today = new Date().toISOString().slice(0, 10);

  res.status(200).json(buildPortfolio(records, today));
};
