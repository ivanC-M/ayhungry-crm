const { mapPageToRecord } = require('../lib/notion-map');

test('maps every property type used by the Control Tower schema', () => {
  const page = {
    id: 'page-123',
    properties: {
      Nombre: { type: 'title', title: [{ plain_text: 'Restaurante A' }] },
      Notas: { type: 'rich_text', rich_text: [{ plain_text: 'Nota ' }, { plain_text: 'larga' }] },
      Etapa: { type: 'select', select: { name: 'Cliente Activo' } },
      'Sin seleccion': { type: 'select', select: null },
      'Modulos activos': { type: 'multi_select', multi_select: [{ name: 'Modulo 1 Reservas' }] },
      'Contrato firmado': { type: 'checkbox', checkbox: true },
      'Monto mensual': { type: 'number', number: 150000 },
      'Proximo seguimiento': { type: 'date', date: { start: '2026-09-15' } },
      'Sin fecha': { type: 'date', date: null },
      'Teléfono': { type: 'phone_number', phone_number: '+56912345678' },
      Email: { type: 'email', email: 'contacto@restaurante.cl' },
      'Grupo / Cliente matriz': { type: 'relation', relation: [{ id: 'page-999' }] },
      'Dias sin contacto': { type: 'formula', formula: { type: 'number', number: 5 } },
    },
  };

  const record = mapPageToRecord(page);

  expect(record).toEqual({
    id: 'page-123',
    Nombre: 'Restaurante A',
    Notas: 'Nota larga',
    Etapa: 'Cliente Activo',
    'Sin seleccion': null,
    'Modulos activos': ['Modulo 1 Reservas'],
    'Contrato firmado': true,
    'Monto mensual': 150000,
    'Proximo seguimiento': '2026-09-15',
    'Sin fecha': null,
    'Teléfono': '+56912345678',
    Email: 'contacto@restaurante.cl',
    'Grupo / Cliente matriz': ['page-999'],
    'Dias sin contacto': 5,
  });
});
