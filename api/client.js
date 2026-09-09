const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/require-auth');
const { buildClientView } = require('../lib/client-view');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'control-tower-snapshot.json');

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

  const snapshot = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf8'));
  const record = snapshot.records.find((r) => r.id === id);
  if (!record) {
    res.status(404).json({ error: 'Cliente no encontrado' });
    return;
  }

  const relatedNames = {};
  for (const other of snapshot.records) {
    relatedNames[other.id] = other['Nombre'];
  }

  res.status(200).json(buildClientView(record, relatedNames));
};
