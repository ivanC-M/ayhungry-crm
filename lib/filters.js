function excludeGroups(records) {
  return records.filter((record) => record['Tipo de ficha'] !== 'Grupo');
}

module.exports = { excludeGroups };
