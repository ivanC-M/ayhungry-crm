const fs = require('fs');
const path = require('path');
const { isAuthenticated } = require('../lib/require-auth');
const { excludeGroups } = require('../lib/filters');
const { buildWeeklyReport, pickPreviousSnapshotDate } = require('../lib/weekly');

const SNAPSHOT_PATH = path.join(__dirname, '..', 'data', 'control-tower-snapshot.json');
const SNAPSHOTS_DIR = path.join(__dirname, '..', 'data', 'snapshots');

function readSnapshot(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listAvailableDates() {
  try {
    return fs
      .readdirSync(SNAPSHOTS_DIR)
      .filter((file) => /^\d{4}-\d{2}-\d{2}\.json$/.test(file))
      .map((file) => file.slice(0, 10));
  } catch (e) {
    return [];
  }
}

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const current = readSnapshot(SNAPSHOT_PATH);
  const currentDate = current.generatedAt.slice(0, 10);
  const previousDate = pickPreviousSnapshotDate(listAvailableDates(), currentDate);

  if (!previousDate) {
    res.status(200).json({
      available: false,
      currentGeneratedAt: current.generatedAt,
    });
    return;
  }

  const previous = readSnapshot(path.join(SNAPSHOTS_DIR, `${previousDate}.json`));

  const report = buildWeeklyReport(
    excludeGroups(previous.records),
    excludeGroups(current.records),
    previous.generatedAt,
    current.generatedAt
  );

  res.status(200).json({ available: true, ...report });
};
