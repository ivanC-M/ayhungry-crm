function textFromRichText(richTextArray) {
  if (!richTextArray || richTextArray.length === 0) return '';
  return richTextArray.map((t) => t.plain_text).join('');
}

function mapPageToRecord(page) {
  const record = { id: page.id };
  for (const [name, prop] of Object.entries(page.properties)) {
    switch (prop.type) {
      case 'title':
        record[name] = textFromRichText(prop.title);
        break;
      case 'rich_text':
        record[name] = textFromRichText(prop.rich_text);
        break;
      case 'select':
        record[name] = prop.select ? prop.select.name : null;
        break;
      case 'multi_select':
        record[name] = prop.multi_select.map((o) => o.name);
        break;
      case 'checkbox':
        record[name] = prop.checkbox;
        break;
      case 'number':
        record[name] = prop.number;
        break;
      case 'date':
        record[name] = prop.date ? prop.date.start : null;
        break;
      case 'phone_number':
        record[name] = prop.phone_number;
        break;
      case 'email':
        record[name] = prop.email;
        break;
      case 'relation':
        record[name] = prop.relation.map((r) => r.id);
        break;
      case 'formula':
        record[name] = prop.formula[prop.formula.type];
        break;
      default:
        record[name] = null;
    }
  }
  return record;
}

module.exports = { mapPageToRecord };
