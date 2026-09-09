const { buildPortfolio, PORTFOLIO_FIELDS } = require('../lib/portfolio');

test('excludes groups, resolves grupoNombre via relation, and tags urgencia', () => {
  const records = [
    { id: 'g1', Nombre: 'Holding X', 'Tipo de ficha': 'Grupo' },
    {
      id: 'c1',
      Nombre: 'Restaurante A',
      'Tipo de ficha': 'Marca',
      'Grupo / Cliente matriz': ['g1'],
      Etapa: 'Cliente Activo',
      Tier: 'Tier 1',
      'Proximo seguimiento': '2026-09-01',
      'En riesgo': false,
    },
    {
      id: 'c2',
      Nombre: 'Restaurante B',
      'Tipo de ficha': 'Independiente',
      'Grupo / Cliente matriz': [],
      Etapa: 'Nuevo Lead',
      Tier: 'Tier 3',
      'Proximo seguimiento': '2026-09-20',
      'En riesgo': false,
    },
  ];

  const result = buildPortfolio(records, '2026-09-09');

  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ id: 'c1', grupoNombre: 'Holding X', urgencia: 'overdue' });
  expect(result[1]).toMatchObject({ id: 'c2', grupoNombre: null, urgencia: 'ok' });
});

test('PORTFOLIO_FIELDS includes the columns defined in the design spec', () => {
  expect(PORTFOLIO_FIELDS).toEqual(
    expect.arrayContaining(['Etapa', 'Tier', 'Ultimo contacto', 'Proximo seguimiento', 'Monto mensual', 'En riesgo'])
  );
});
