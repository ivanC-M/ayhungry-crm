function computeMRR(records) {
  const totals = { CLP: 0, UF: 0 };
  for (const record of records) {
    if (record['Contrato firmado'] !== true) continue;
    const currency = record['Moneda'] === 'UF' ? 'UF' : 'CLP';
    totals[currency] += record['Monto mensual'] || 0;
  }
  return totals;
}

function groupByEtapa(records) {
  const counts = {};
  for (const record of records) {
    const etapa = record['Etapa'] || 'Sin etapa';
    counts[etapa] = (counts[etapa] || 0) + 1;
  }
  return counts;
}

function groupByTier(records) {
  const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };
  for (const record of records) {
    if (counts[record['Tier']] !== undefined) counts[record['Tier']] += 1;
  }
  return counts;
}

function countAtRisk(records) {
  return records.filter((record) => record['En riesgo'] === true).length;
}

function countChurn(records) {
  const churned = records.filter((record) => record['Etapa'] === 'Churn');
  const byMotivo = {};
  for (const record of churned) {
    const motivo = record['Motivo churn'] || 'Sin motivo';
    byMotivo[motivo] = (byMotivo[motivo] || 0) + 1;
  }
  return { total: churned.length, byMotivo };
}

function computeConversion(records) {
  if (records.length === 0) return 0;
  const clientes = records.filter((record) => record['Contrato firmado'] === true).length;
  return clientes / records.length;
}

module.exports = {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
};
