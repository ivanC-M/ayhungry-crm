const { excludeGroups } = require('../lib/filters');

test('excludes records whose Tipo de ficha is Grupo', () => {
  const records = [
    { Nombre: 'Restaurante A', 'Tipo de ficha': 'Independiente' },
    { Nombre: 'Grupo Holding', 'Tipo de ficha': 'Grupo' },
    { Nombre: 'Marca B', 'Tipo de ficha': 'Marca' },
  ];
  const result = excludeGroups(records);
  expect(result.map((r) => r.Nombre)).toEqual(['Restaurante A', 'Marca B']);
});

test('keeps records with missing Tipo de ficha', () => {
  const records = [{ Nombre: 'Sin tipo' }];
  expect(excludeGroups(records)).toHaveLength(1);
});
