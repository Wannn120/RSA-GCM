'use strict';

function stringify(value, indent = 2) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, indent);
}

function table(rows, columns) {
  if (!rows.length) return '(tidak ada data)';
  const widths = {};
  for (const col of columns) {
    widths[col] = Math.max(col.length, ...rows.map(row => String(row[col] ?? '').length));
  }
  const header = columns.map(col => col.padEnd(widths[col])).join('  ');
  const body = rows.map(row => columns.map(col => String(row[col] ?? '').padEnd(widths[col])).join('  '));
  return [header, ...body].join('\n');
}

module.exports = { stringify, table };
