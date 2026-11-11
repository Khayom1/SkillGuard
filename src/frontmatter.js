/** Lightweight frontmatter reader for the Agent Skills format.
 * It intentionally validates the fields SkillGuard relies on without pretending
 * to be a complete YAML parser.
 */

function unquote(value) {
  const text = value.trim();
  if (text.length >= 2 && ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'")))) {
    return text.slice(1, -1).replace(/\\([\\"'])/g, '$1');
  }
  return text.replace(/\s+#.*$/, '').trim();
}

export function parseFrontmatter(content) {
  const text = String(content ?? '').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== '---') {
    return { found: false, valid: false, fields: {}, body: text, errors: ['Frontmatter must start with --- on the first line.'] };
  }

  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing < 0) {
    return { found: true, valid: false, fields: {}, body: '', errors: ['Frontmatter is missing its closing --- delimiter.'] };
  }

  const fields = {};
  const errors = [];
  let currentKey = null;
  let blockIndent = null;

  for (let index = 1; index < closing; index += 1) {
    const line = lines[index];
    if (!line.trim() || /^\s*#/.test(line)) continue;
    // Agent Skills permits a nested metadata mapping; this lightweight parser
    // validates the fields SkillGuard needs and leaves metadata values alone.
    if (/^\s+/.test(line) && Object.hasOwn(fields, 'metadata')) continue;

    if (blockIndent !== null) {
      const indent = line.match(/^\s*/)?.[0].length ?? 0;
      if (line.trim() && indent >= blockIndent) {
        fields[currentKey] = `${fields[currentKey] ?? ''}${fields[currentKey] ? '\n' : ''}${line.trim()}`;
        continue;
      }
      blockIndent = null;
      currentKey = null;
    }

    const match = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!match) {
      errors.push(`Invalid frontmatter line ${index + 1}.`);
      continue;
    }
    const key = match[1];
    const value = match[2].trim();
    if (Object.hasOwn(fields, key)) errors.push(`Duplicate frontmatter field: ${key}.`);
    if (value === '|' || value === '>') {
      fields[key] = '';
      currentKey = key;
      blockIndent = line.match(/^\s*/)?.[0].length + 2;
    } else if (value === '' && key === 'metadata') {
      fields[key] = '';
    } else {
      fields[key] = unquote(value);
    }
  }

  const name = fields.name;
  const description = fields.description;
  if (!name) errors.push('Required field "name" is missing or empty.');
  else {
    if (name.length > 64) errors.push('Field "name" must be 64 characters or fewer.');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(name)) errors.push('Field "name" must use lowercase letters, numbers, and single hyphens only.');
  }
  if (!description) errors.push('Required field "description" is missing or empty.');
  else if (description.length > 1024) errors.push('Field "description" must be 1024 characters or fewer.');
  if (fields.compatibility && fields.compatibility.length > 500) errors.push('Field "compatibility" must be 500 characters or fewer.');

  return {
    found: true,
    valid: errors.length === 0,
    fields,
    body: lines.slice(closing + 1).join('\n'),
    errors,
    frontmatterLineCount: closing + 1
  };
}
