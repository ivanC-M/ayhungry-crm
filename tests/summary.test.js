const { buildSummary } = require('../lib/summary');

test('composes filters + aggregates into a single summary, excluding groups', () => {
  const records = [
    { id: 'g1', 'Tipo de ficha': 'Grupo' },
    { id: 'c1', 'Tipo de ficha': 'Independiente', Etapa: 'Cliente Activo', Tier: 'Tier 1', 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 100000, 'En riesgo': false },
    { id: 'c2', 'Tipo de ficha': 'Independiente', Etapa: 'Churn', Tier: 'Tier 2', 'Contrato firmado': false, 'Motivo churn': 'Precio', 'En riesgo': false },
  ];

  const summary = buildSummary(records);

  expect(summary.mrr).toEqual({ CLP: 100000, UF: 0 });
  expect(summary.pipelinePorEtapa).toEqual({ 'Cliente Activo': 1, Churn: 1 });
  expect(summary.distribucionPorTier).toEqual({ 'Tier 1': 1, 'Tier 2': 1, 'Tier 3': 0 });
  expect(summary.enRiesgo).toBe(0);
  expect(summary.churn).toEqual({ total: 1, byMotivo: { Precio: 1 } });
  expect(summary.conversion).toBe(0.5);
});
