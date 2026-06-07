# Markdown Bullet Extraction Logic

This project contains a specialized Markdown bullet extraction utility designed to be tolerant of various indentation levels and list styles.

## Extraction Rules

### Standard Bullets
- Supports `*`, `-`, `+` as unordered list markers.
- Supports `1.`, `1)` as ordered list markers.
- Handles arbitrary indentation (spaces and tabs).

### Extended Roman Numerals (Experimental)
The `extended` mode enables support for Roman numerals (`i`, `v`, `x`, etc.).

#### Failure Rule for Invalid Roman Numerals
The extractor uses a permissive regex `[ivxlcdm]+` for performance. It **does not** perform strict semantic validation of Roman numerals.

- **Input:** `IIV. Content`
- **Behavior:** Matches as a bullet because it consists of valid Roman characters.
- **Output:** `Content`

- **Input:** `XXXX. Content`
- **Behavior:** Matches as a bullet.
- **Output:** `Content`

**Reasoning:** To maintain high performance and avoid complex grammar parsers, any sequence of Roman characters followed by `.` or `)` is treated as a list marker in extended mode.

## Testing & CI

### Coverage Thresholds
The project maintains a **100% coverage requirement** for the bullet extraction logic.

### CI Workflow
The suite runs on every Pull Request via GitHub Actions, generating:
- `markdown-bullets-report.json`: Machine-readable test results.
- `coverage/index.html`: Human-readable coverage report.
