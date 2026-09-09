function isOverdue(proximoSeguimiento, today) {
  if (!proximoSeguimiento) return false;
  return new Date(proximoSeguimiento) < new Date(today);
}

function getUrgencyLevel(record, today) {
  if (record['En riesgo'] === true) return 'at-risk';
  if (isOverdue(record['Proximo seguimiento'], today)) return 'overdue';
  return 'ok';
}

module.exports = { isOverdue, getUrgencyLevel };
