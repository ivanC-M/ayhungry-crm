const { excludeGroups } = require('./filters');
const { getUrgencyLevel } = require('./urgency');

const PORTFOLIO_FIELDS = [
  'Nombre',
  'Grupo / Cliente matriz',
  'Etapa',
  'Tier',
  'Ultimo contacto',
  'Proximo seguimiento',
  'Monto mensual',
  'Moneda',
  'Contrato firmado',
  'En riesgo',
  'Contacto principal',
  'Teléfono',
];

function pick(record, fields) {
  const picked = { id: record.id };
  for (const field of fields) picked[field] = record[field] === undefined ? null : record[field];
  return picked;
}

function buildIdToNameMap(records) {
  const map = {};
  for (const record of records) map[record.id] = record['Nombre'];
  return map;
}

function resolveGrupoNombre(record, idToName) {
  const ids = record['Grupo / Cliente matriz'] || [];
  if (ids.length === 0) return null;
  const names = ids.map((id) => idToName[id]).filter(Boolean);
  return names.length ? names.join(', ') : null;
}

function buildPortfolio(records, today) {
  const idToName = buildIdToNameMap(records);
  return excludeGroups(records).map((record) => ({
    ...pick(record, PORTFOLIO_FIELDS),
    grupoNombre: resolveGrupoNombre(record, idToName),
    urgencia: getUrgencyLevel(record, today),
  }));
}

module.exports = { buildPortfolio, PORTFOLIO_FIELDS };
