const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/require-auth');
const { buildSummary } = require('../lib/summary');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'control-tower-snapshot.json');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));

  res.status(200).json(buildSummary(snapshot.records));
};
