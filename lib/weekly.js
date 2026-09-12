const ETAPA_ORDER = [
  'Nuevo Lead',
  'Contactado',
  'Calificado',
  'Demo / Reunión',
  'Propuesta Enviada',
  'Negociando',
  'Acuerdo Alcanzado',
  'Período de Prueba',
  'En Proceso de Pago',
  'Cliente Activo',
  'En Riesgo',
  'Perdido',
  'Churn',
];

function etapaRank(etapa) {
  const index = ETAPA_ORDER.indexOf(etapa);
  return index === -1 ? null : index;
}

function isRecentContact(ultimoContacto, sinceIso) {
  if (!ultimoContacto) return false;
  return new Date(ultimoContacto) >= new Date(sinceIso);
}

function buildWeeklyReport(previousRecords, currentRecords, previousGeneratedAt, currentGeneratedAt) {
  const previousById = new Map(previousRecords.map((record) => [record.id, record]));
  const windowDays = Math.max(
    1,
    Math.round((new Date(currentGeneratedAt) - new Date(previousGeneratedAt)) / 86400000)
  );

  const cierres = [];
  const avance = [];
  const churnNuevo = [];
  const perdidosNuevo = [];
  const contactadosWhatsapp = [];
  const nuevos = [];

  for (const current of currentRecords) {
    const nombre = current['Nombre'] || 'Sin nombre';

    if (isRecentContact(current['Ultimo contacto'], previousGeneratedAt)) {
      contactadosWhatsapp.push(nombre);
    }

    const previous = previousById.get(current.id);
    if (!previous) {
      nuevos.push(nombre);
      continue;
    }

    const etapaAntes = previous['Etapa'];
    const etapaAhora = current['Etapa'];
    if (etapaAntes === etapaAhora) continue;

    if (etapaAhora === 'Cliente Activo' && etapaAntes !== 'Cliente Activo') {
      cierres.push({ nombre, etapaAntes });
      continue;
    }
    if (etapaAhora === 'Churn' && etapaAntes !== 'Churn') {
      churnNuevo.push({ nombre, etapaAntes });
      continue;
    }
    if (etapaAhora === 'Perdido' && etapaAntes !== 'Perdido') {
      perdidosNuevo.push({ nombre, etapaAntes });
      continue;
    }

    const rankAntes = etapaRank(etapaAntes);
    const rankAhora = etapaRank(etapaAhora);
    if (rankAntes !== null && rankAhora !== null && rankAhora > rankAntes) {
      avance.push({ nombre, etapaAntes, etapaAhora });
    }
  }

  return {
    previousGeneratedAt,
    currentGeneratedAt,
    windowDays,
    cierres: { count: cierres.length, clientes: cierres },
    avance: { count: avance.length, clientes: avance },
    contactadosWhatsapp: { count: contactadosWhatsapp.length, clientes: contactadosWhatsapp },
    nuevosLeads: { count: nuevos.length, clientes: nuevos },
    churnNuevo: { count: churnNuevo.length, clientes: churnNuevo },
    perdidosNuevo: { count: perdidosNuevo.length, clientes: perdidosNuevo },
  };
}

function pickPreviousSnapshotDate(availableDates, currentDate, targetDays = 7) {
  const candidates = availableDates.filter((date) => date < currentDate).sort();
  if (candidates.length === 0) return null;

  const cutoff = new Date(`${currentDate}T00:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() - targetDays);
  const cutoffDate = cutoff.toISOString().slice(0, 10);

  const eligible = candidates.filter((date) => date <= cutoffDate);
  if (eligible.length > 0) return eligible[eligible.length - 1];

  return candidates[0];
}

module.exports = { ETAPA_ORDER, etapaRank, buildWeeklyReport, pickPreviousSnapshotDate };
