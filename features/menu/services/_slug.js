// features/menu/services/_slug.js
'use strict';
function toSlug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
module.exports = { toSlug };
