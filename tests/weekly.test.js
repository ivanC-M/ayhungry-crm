const { etapaRank, buildWeeklyReport, pickPreviousSnapshotDate } = require('../lib/weekly');

test('etapaRank orders stages from Nuevo Lead to Churn', () => {
  expect(etapaRank('Nuevo Lead')).toBe(0);
  expect(etapaRank('Cliente Activo')).toBeLessThan(etapaRank('Churn'));
  expect(etapaRank('Contactado')).toBeLessThan(etapaRank('Negociando'));
});

test('etapaRank returns null for unknown or missing stages', () => {
  expect(etapaRank(null)).toBeNull();
  expect(etapaRank('Sin etapa')).toBeNull();
});

test('buildWeeklyReport counts a stage change into Cliente Activo as a cierre', () => {
  const previous = [{ id: '1', Nombre: 'Paku', Etapa: 'Acuerdo Alcanzado' }];
  const current = [{ id: '1', Nombre: 'Paku', Etapa: 'Cliente Activo' }];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.cierres).toEqual({ count: 1, clientes: [{ nombre: 'Paku', etapaAntes: 'Acuerdo Alcanzado' }] });
  expect(report.avance.count).toBe(0);
});

test('buildWeeklyReport counts forward stage moves that do not land on Cliente Activo as avance', () => {
  const previous = [{ id: '1', Nombre: 'Lead A', Etapa: 'Nuevo Lead' }];
  const current = [{ id: '1', Nombre: 'Lead A', Etapa: 'Demo / Reunión' }];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.avance).toEqual({
    count: 1,
    clientes: [{ nombre: 'Lead A', etapaAntes: 'Nuevo Lead', etapaAhora: 'Demo / Reunión' }],
  });
});

test('buildWeeklyReport does not count a backward stage move as avance', () => {
  const previous = [{ id: '1', Nombre: 'Lead A', Etapa: 'Negociando' }];
  const current = [{ id: '1', Nombre: 'Lead A', Etapa: 'Contactado' }];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.avance.count).toBe(0);
});

test('buildWeeklyReport flags new Churn and new Perdido separately from avance/cierres', () => {
  const previous = [
    { id: '1', Nombre: 'Cliente X', Etapa: 'Cliente Activo' },
    { id: '2', Nombre: 'Lead Y', Etapa: 'Negociando' },
  ];
  const current = [
    { id: '1', Nombre: 'Cliente X', Etapa: 'Churn' },
    { id: '2', Nombre: 'Lead Y', Etapa: 'Perdido' },
  ];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.churnNuevo).toEqual({ count: 1, clientes: [{ nombre: 'Cliente X', etapaAntes: 'Cliente Activo' }] });
  expect(report.perdidosNuevo).toEqual({ count: 1, clientes: [{ nombre: 'Lead Y', etapaAntes: 'Negociando' }] });
  expect(report.avance.count).toBe(0);
  expect(report.cierres.count).toBe(0);
});

test('buildWeeklyReport counts records only present in the current snapshot as nuevosLeads', () => {
  const previous = [{ id: '1', Nombre: 'Existing', Etapa: 'Nuevo Lead' }];
  const current = [
    { id: '1', Nombre: 'Existing', Etapa: 'Nuevo Lead' },
    { id: '2', Nombre: 'Brand New Lead', Etapa: 'Nuevo Lead' },
  ];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.nuevosLeads).toEqual({ count: 1, clientes: ['Brand New Lead'] });
});

test('buildWeeklyReport counts clients whose Ultimo contacto falls on/after the previous snapshot date', () => {
  const previous = [];
  const current = [
    { id: '1', Nombre: 'Contactado reciente', Etapa: 'Contactado', 'Ultimo contacto': '2026-09-10' },
    { id: '2', Nombre: 'Contacto viejo', Etapa: 'Contactado', 'Ultimo contacto': '2026-08-01' },
    { id: '3', Nombre: 'Sin contacto', Etapa: 'Contactado', 'Ultimo contacto': null },
  ];
  const report = buildWeeklyReport(previous, current, '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.contactadosWhatsapp).toEqual({ count: 1, clientes: ['Contactado reciente'] });
});

test('buildWeeklyReport computes windowDays from the gap between snapshot dates', () => {
  const report = buildWeeklyReport([], [], '2026-09-05T00:00:00Z', '2026-09-12T00:00:00Z');
  expect(report.windowDays).toBe(7);
});

test('pickPreviousSnapshotDate picks the date closest to (but not after) 7 days back', () => {
  const dates = ['2026-09-01', '2026-09-05', '2026-09-08', '2026-09-11'];
  expect(pickPreviousSnapshotDate(dates, '2026-09-12')).toBe('2026-09-05');
});

test('pickPreviousSnapshotDate falls back to the oldest available date when nothing is 7+ days old', () => {
  const dates = ['2026-09-09', '2026-09-11'];
  expect(pickPreviousSnapshotDate(dates, '2026-09-12')).toBe('2026-09-09');
});

test('pickPreviousSnapshotDate returns null when there is no earlier snapshot at all', () => {
  expect(pickPreviousSnapshotDate([], '2026-09-12')).toBeNull();
  expect(pickPreviousSnapshotDate(['2026-09-12'], '2026-09-12')).toBeNull();
});
