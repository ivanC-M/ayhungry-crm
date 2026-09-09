const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/require-auth');
const { buildPortfolio } = require('../lib/portfolio');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'control-tower-snapshot.json');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);

  res.status(200).json(buildPortfolio(snapshot.records, today));
};
