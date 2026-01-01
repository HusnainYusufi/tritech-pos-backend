# Inventory Import: Auto-create Categories

- Extend existing `/t/inventory/items/import` flow to auto-create missing categories from the uploaded CSV/XLSX when a category name is not found.
- Keep single-upload experience: same file provides category names; newly created category IDs should be used for items in that upload.
- Respect existing options; set sensible defaults so cashiers don’t need extra steps.
- Document the behavior in Swagger/request options/template notes.

