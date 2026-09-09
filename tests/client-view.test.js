const { buildClientView } = require('../lib/client-view');

test('builds header, tabs, and flags missing Ficha Google / Facturación data', () => {
  const record = {
    id: 'c1',
    Nombre: 'Restaurante A',
    'Contacto principal': 'Juan Pérez',
    Etapa: 'Cliente Activo',
    'Proximo seguimiento': '2026-09-15',
    'Tipo de negocio': 'Restaurant',
    'Canal origen': 'Instagram',
    Comuna: 'Providencia',
    Region: 'RM',
    Ejecutivo: 'Ivan',
    'Numero de locales': 2,
    'Teléfono': '+56911111111',
    Email: 'juan@restaurantea.cl',
    'Fecha inicio prueba': '2026-06-01',
    'Fecha inicio contrato': '2026-07-01',
    'Contrato firmado': true,
    'Monto mensual': 150000,
    Moneda: 'CLP',
    RUT: null,
    'Razon social': null,
    'Fecha primer contacto': '2026-05-20',
    'Ultimo contacto': '2026-09-01',
    'En riesgo': false,
  };

  const view = buildClientView(record, {});

  expect(view.header).toEqual({
    nombre: 'Restaurante A',
    contactoPrincipal: 'Juan Pérez',
    etapa: 'Cliente Activo',
    proximoSeguimiento: '2026-09-15',
  });
  expect(view.tabs.fichaGoogle).toEqual({ sinDatos: true });
  expect(view.tabs.facturacion).toMatchObject({ rut: null, razonSocial: null, sinDatos: true });
  expect(view.tabs.infoGeneral).toMatchObject({ tipoDeNegocio: 'Restaurant', comuna: 'Providencia' });
  expect(view.tabs.pruebaPago).toMatchObject({ contratoFirmado: true, montoMensual: 150000, moneda: 'CLP' });
  expect(view.tabs.historial).toMatchObject({ fechaPrimerContacto: '2026-05-20', ultimoContacto: '2026-09-01' });
});

test('resolves grupoNombre from the relatedNames map when a group relation exists', () => {
  const record = { id: 'c1', Nombre: 'Restaurante A', 'Grupo / Cliente matriz': ['g1'] };
  const view = buildClientView(record, { g1: 'Holding X' });
  expect(view.tabs.infoGeneral.grupoNombre).toBe('Holding X');
});
