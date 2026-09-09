const { isAuthenticated } = require('../lib/require-auth');
const { getClient, fetchPage } = require('../lib/notion-client');
const { mapPageToRecord } = require('../lib/notion-map');
const { buildClientView } = require('../lib/client-view');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const { id } = req.query;
  if (!id) {
    res.status(400).json({ error: 'Falta el parametro id' });
    return;
  }

  const client = getClient();
  const page = await fetchPage(client, id);
  const record = mapPageToRecord(page);

  const groupIds = record['Grupo / Cliente matriz'] || [];
  const relatedNames = {};
  for (const groupId of groupIds) {
    const relatedPage = await fetchPage(client, groupId);
    relatedNames[groupId] = mapPageToRecord(relatedPage)['Nombre'];
  }

  res.status(200).json(buildClientView(record, relatedNames));
};
