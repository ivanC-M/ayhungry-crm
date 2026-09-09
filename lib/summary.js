const { excludeGroups } = require('./filters');
const {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
} = require('./aggregate');

function buildSummary(records) {
  const filtered = excludeGroups(records);
  return {
    mrr: computeMRR(filtered),
    pipelinePorEtapa: groupByEtapa(filtered),
    distribucionPorTier: groupByTier(filtered),
    enRiesgo: countAtRisk(filtered),
    churn: countChurn(filtered),
    conversion: computeConversion(filtered),
  };
}

module.exports = { buildSummary };
