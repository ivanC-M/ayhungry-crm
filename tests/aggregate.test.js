const {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
} = require('../lib/aggregate');

test('computeMRR keeps CLP and UF separate and only counts signed contracts', () => {
  const records = [
    { 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 100000 },
    { 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 50000 },
    { 'Contrato firmado': true, Moneda: 'UF', 'Monto mensual': 8 },
    { 'Contrato firmado': false, Moneda: 'CLP', 'Monto mensual': 999999 },
  ];
  expect(computeMRR(records)).toEqual({ CLP: 150000, UF: 8 });
});

test('groupByEtapa counts records per stage', () => {
  const records = [{ Etapa: 'Nuevo Lead' }, { Etapa: 'Nuevo Lead' }, { Etapa: 'Cliente Activo' }];
  expect(groupByEtapa(records)).toEqual({ 'Nuevo Lead': 2, 'Cliente Activo': 1 });
});

test('groupByTier always includes all three tiers', () => {
  const records = [{ Tier: 'Tier 1' }, { Tier: 'Tier 1' }];
  expect(groupByTier(records)).toEqual({ 'Tier 1': 2, 'Tier 2': 0, 'Tier 3': 0 });
});

test('countAtRisk counts En riesgo = true', () => {
  const records = [{ 'En riesgo': true }, { 'En riesgo': false }, { 'En riesgo': true }];
  expect(countAtRisk(records)).toBe(2);
});

test('countChurn counts Etapa = Churn and breaks down by Motivo churn', () => {
  const records = [
    { Etapa: 'Churn', 'Motivo churn': 'Precio' },
    { Etapa: 'Churn', 'Motivo churn': 'Precio' },
    { Etapa: 'Churn', 'Motivo churn': 'Competencia' },
    { Etapa: 'Perdido', 'Motivo perdida': 'Precio' },
  ];
  expect(countChurn(records)).toEqual({
    total: 3,
    byMotivo: { Precio: 2, Competencia: 1 },
  });
});

test('computeConversion is clientes / total', () => {
  const records = [
    { 'Contrato firmado': true },
    { 'Contrato firmado': false },
    { 'Contrato firmado': false },
    { 'Contrato firmado': false },
  ];
  expect(computeConversion(records)).toBe(0.25);
});

test('computeConversion returns 0 for an empty list', () => {
  expect(computeConversion([])).toBe(0);
});
