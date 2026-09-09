# AyHungry CRM — Dashboard Visual v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only visual dashboard (Portafolio + Ficha Cliente + Resumen Ejecutivo) served from this repo, backed live by the Notion Control Tower via serverless functions.

**Architecture:** Vanilla HTML/CSS/JS frontend (no build step, no framework) at the repo root, served as static files by Vercel. `api/*.js` Vercel serverless functions act as an authenticated proxy to the Notion API using `@notionhq/client` — the Notion token never reaches the browser. Business logic (filtering, urgency, aggregation, field mapping) lives in pure, unit-tested modules under `lib/`, imported by the thin `api/*.js` handlers. No database of our own; Notion is the only source of truth, queried live on every request.

**Tech Stack:** Node.js (CommonJS, no TypeScript), `@notionhq/client`, Jest for unit tests, Vercel for hosting + serverless functions, no frontend framework.

## Global Constraints

- Read-only in v1: no endpoint may call `client.pages.update` or `client.pages.create`. Every `api/*.js` handler in this plan only reads.
- `Etapa` is never reinterpreted or overridden locally — it is always read verbatim from Notion and displayed as-is (see `docs/superpowers/specs/2026-09-09-dashboard-visual-v1-design.md`).
- Notion Control Tower data source ID: `9baa8b5c-203f-4fa8-8742-6b3b87c79318` — this is the exact value for `NOTION_DATABASE_ID`.
- Every portfolio/summary computation excludes group cards: `record['Tipo de ficha'] === 'Grupo'` must be filtered out (per `reference_control_tower_notion` — the historical `!=` bug that also drops NULLs does not apply here since we compare with strict equality against the literal `'Grupo'`, which correctly keeps blank/undefined values in).
- MRR must never sum `Monto mensual` across different `Moneda` values (UF vs CLP) into one number — always keep the two currencies separate.
- No secrets (Notion token, dashboard password, session secret) are ever written into any file committed to git. They live only in Vercel environment variables and in a local `.env` (gitignored) for `vercel dev`.
- All dates read from Notion are ISO 8601 strings (e.g. `"2026-09-09"`); compare them as `Date` objects, never as raw strings.

---

### Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `vercel.json`
- Create: `jest.config.js`

**Interfaces:**
- Produces: an `npm test` command (Jest) and an `npm run dev` command (`vercel dev`) that every later task relies on.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "ayhungry-crm-dashboard",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "test": "jest",
    "dev": "vercel dev"
  },
  "dependencies": {
    "@notionhq/client": "^2.2.15"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "vercel": "^37.0.0"
  }
}
```

- [ ] **Step 2: Create `jest.config.js`**

```js
module.exports = {
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/'],
};
```

- [ ] **Step 3: Create `.gitignore`**

```
node_modules/
.env
.vercel/
```

- [ ] **Step 4: Create `.env.example`**

```
NOTION_TOKEN=secret_xxx
NOTION_DATABASE_ID=9baa8b5c-203f-4fa8-8742-6b3b87c79318
DASHBOARD_PASSWORD=change-me
SESSION_SECRET=change-me-too-a-long-random-string
```

- [ ] **Step 5: Create `vercel.json`**

```json
{
  "functions": {
    "api/*.js": {
      "runtime": "nodejs20.x"
    }
  }
}
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, `package-lock.json` created, no errors.

- [ ] **Step 7: Verify test runner works with zero tests**

Run: `npx jest --passWithNoTests`
Expected: `No tests found, exiting with code 0` (or similar), exit code 0.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json jest.config.js .gitignore .env.example vercel.json
git commit -m "Scaffold Node project for dashboard backend (Jest + Vercel)"
```

---

### Task 2: `lib/filters.js` — exclude group cards

**Files:**
- Create: `lib/filters.js`
- Test: `tests/filters.test.js`

**Interfaces:**
- Produces: `excludeGroups(records: object[]): object[]` — used by Tasks 9, 11.

- [ ] **Step 1: Write the failing test**

```js
// tests/filters.test.js
const { excludeGroups } = require('../lib/filters');

test('excludes records whose Tipo de ficha is Grupo', () => {
  const records = [
    { Nombre: 'Restaurante A', 'Tipo de ficha': 'Independiente' },
    { Nombre: 'Grupo Holding', 'Tipo de ficha': 'Grupo' },
    { Nombre: 'Marca B', 'Tipo de ficha': 'Marca' },
  ];
  const result = excludeGroups(records);
  expect(result.map((r) => r.Nombre)).toEqual(['Restaurante A', 'Marca B']);
});

test('keeps records with missing Tipo de ficha', () => {
  const records = [{ Nombre: 'Sin tipo' }];
  expect(excludeGroups(records)).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/filters.test.js`
Expected: FAIL with "Cannot find module '../lib/filters'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/filters.js
function excludeGroups(records) {
  return records.filter((record) => record['Tipo de ficha'] !== 'Grupo');
}

module.exports = { excludeGroups };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/filters.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/filters.js tests/filters.test.js
git commit -m "Add excludeGroups filter for portfolio/summary queries"
```

---

### Task 3: `lib/urgency.js` — overdue/at-risk classification

**Files:**
- Create: `lib/urgency.js`
- Test: `tests/urgency.test.js`

**Interfaces:**
- Produces: `isOverdue(proximoSeguimiento: string|null, today: string): boolean` and `getUrgencyLevel(record: object, today: string): 'at-risk'|'overdue'|'ok'` — used by Task 9.

- [ ] **Step 1: Write the failing test**

```js
// tests/urgency.test.js
const { isOverdue, getUrgencyLevel } = require('../lib/urgency');

test('isOverdue is true when date is before today', () => {
  expect(isOverdue('2026-09-01', '2026-09-09')).toBe(true);
});

test('isOverdue is false when date is today or future', () => {
  expect(isOverdue('2026-09-09', '2026-09-09')).toBe(false);
  expect(isOverdue('2026-09-15', '2026-09-09')).toBe(false);
});

test('isOverdue is false when date is null', () => {
  expect(isOverdue(null, '2026-09-09')).toBe(false);
});

test('getUrgencyLevel prioritizes at-risk over overdue', () => {
  const record = { 'En riesgo': true, 'Proximo seguimiento': '2026-09-01' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('at-risk');
});

test('getUrgencyLevel returns overdue when only the date is late', () => {
  const record = { 'En riesgo': false, 'Proximo seguimiento': '2026-09-01' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('overdue');
});

test('getUrgencyLevel returns ok otherwise', () => {
  const record = { 'En riesgo': false, 'Proximo seguimiento': '2026-09-15' };
  expect(getUrgencyLevel(record, '2026-09-09')).toBe('ok');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/urgency.test.js`
Expected: FAIL with "Cannot find module '../lib/urgency'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/urgency.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/urgency.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/urgency.js tests/urgency.test.js
git commit -m "Add urgency classification (overdue/at-risk) for portfolio rows"
```

---

### Task 4: `lib/aggregate.js` — executive summary math

**Files:**
- Create: `lib/aggregate.js`
- Test: `tests/aggregate.test.js`

**Interfaces:**
- Produces: `computeMRR`, `groupByEtapa`, `groupByTier`, `countAtRisk`, `countChurn`, `computeConversion` — used by Task 11.

- [ ] **Step 1: Write the failing test**

```js
// tests/aggregate.test.js
const {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
} = require('../lib/aggregate');

test('computeMRR keeps CLP and UF separate and only counts signed contracts', () => {
  const records = [
    { 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 100000 },
    { 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 50000 },
    { 'Contrato firmado': true, Moneda: 'UF', 'Monto mensual': 8 },
    { 'Contrato firmado': false, Moneda: 'CLP', 'Monto mensual': 999999 },
  ];
  expect(computeMRR(records)).toEqual({ CLP: 150000, UF: 8 });
});

test('groupByEtapa counts records per stage', () => {
  const records = [{ Etapa: 'Nuevo Lead' }, { Etapa: 'Nuevo Lead' }, { Etapa: 'Cliente Activo' }];
  expect(groupByEtapa(records)).toEqual({ 'Nuevo Lead': 2, 'Cliente Activo': 1 });
});

test('groupByTier always includes all three tiers', () => {
  const records = [{ Tier: 'Tier 1' }, { Tier: 'Tier 1' }];
  expect(groupByTier(records)).toEqual({ 'Tier 1': 2, 'Tier 2': 0, 'Tier 3': 0 });
});

test('countAtRisk counts En riesgo = true', () => {
  const records = [{ 'En riesgo': true }, { 'En riesgo': false }, { 'En riesgo': true }];
  expect(countAtRisk(records)).toBe(2);
});

test('countChurn counts Etapa = Churn and breaks down by Motivo churn', () => {
  const records = [
    { Etapa: 'Churn', 'Motivo churn': 'Precio' },
    { Etapa: 'Churn', 'Motivo churn': 'Precio' },
    { Etapa: 'Churn', 'Motivo churn': 'Competencia' },
    { Etapa: 'Perdido', 'Motivo perdida': 'Precio' },
  ];
  expect(countChurn(records)).toEqual({
    total: 3,
    byMotivo: { Precio: 2, Competencia: 1 },
  });
});

test('computeConversion is clientes / total', () => {
  const records = [
    { 'Contrato firmado': true },
    { 'Contrato firmado': false },
    { 'Contrato firmado': false },
    { 'Contrato firmado': false },
  ];
  expect(computeConversion(records)).toBe(0.25);
});

test('computeConversion returns 0 for an empty list', () => {
  expect(computeConversion([])).toBe(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/aggregate.test.js`
Expected: FAIL with "Cannot find module '../lib/aggregate'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/aggregate.js
function computeMRR(records) {
  const totals = { CLP: 0, UF: 0 };
  for (const record of records) {
    if (record['Contrato firmado'] !== true) continue;
    const currency = record['Moneda'] === 'UF' ? 'UF' : 'CLP';
    totals[currency] += record['Monto mensual'] || 0;
  }
  return totals;
}

function groupByEtapa(records) {
  const counts = {};
  for (const record of records) {
    const etapa = record['Etapa'] || 'Sin etapa';
    counts[etapa] = (counts[etapa] || 0) + 1;
  }
  return counts;
}

function groupByTier(records) {
  const counts = { 'Tier 1': 0, 'Tier 2': 0, 'Tier 3': 0 };
  for (const record of records) {
    if (counts[record['Tier']] !== undefined) counts[record['Tier']] += 1;
  }
  return counts;
}

function countAtRisk(records) {
  return records.filter((record) => record['En riesgo'] === true).length;
}

function countChurn(records) {
  const churned = records.filter((record) => record['Etapa'] === 'Churn');
  const byMotivo = {};
  for (const record of churned) {
    const motivo = record['Motivo churn'] || 'Sin motivo';
    byMotivo[motivo] = (byMotivo[motivo] || 0) + 1;
  }
  return { total: churned.length, byMotivo };
}

function computeConversion(records) {
  if (records.length === 0) return 0;
  const clientes = records.filter((record) => record['Contrato firmado'] === true).length;
  return clientes / records.length;
}

module.exports = {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/aggregate.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/aggregate.js tests/aggregate.test.js
git commit -m "Add executive summary aggregation (MRR, pipeline, tier, churn, conversion)"
```

---

### Task 5: `lib/notion-map.js` — flatten a raw Notion page into a plain record

**Files:**
- Create: `lib/notion-map.js`
- Test: `tests/notion-map.test.js`

**Interfaces:**
- Produces: `mapPageToRecord(page: object): object` — a plain object keyed by Notion property name (e.g. `record['Nombre']`, `record['Etapa']`, `record.id`). Used by Tasks 9, 10, 11.

- [ ] **Step 1: Write the failing test**

```js
// tests/notion-map.test.js
const { mapPageToRecord } = require('../lib/notion-map');

test('maps every property type used by the Control Tower schema', () => {
  const page = {
    id: 'page-123',
    properties: {
      Nombre: { type: 'title', title: [{ plain_text: 'Restaurante A' }] },
      Notas: { type: 'rich_text', rich_text: [{ plain_text: 'Nota ' }, { plain_text: 'larga' }] },
      Etapa: { type: 'select', select: { name: 'Cliente Activo' } },
      'Sin seleccion': { type: 'select', select: null },
      'Modulos activos': { type: 'multi_select', multi_select: [{ name: 'Modulo 1 Reservas' }] },
      'Contrato firmado': { type: 'checkbox', checkbox: true },
      'Monto mensual': { type: 'number', number: 150000 },
      'Proximo seguimiento': { type: 'date', date: { start: '2026-09-15' } },
      'Sin fecha': { type: 'date', date: null },
      'Teléfono': { type: 'phone_number', phone_number: '+56912345678' },
      Email: { type: 'email', email: 'contacto@restaurante.cl' },
      'Grupo / Cliente matriz': { type: 'relation', relation: [{ id: 'page-999' }] },
      'Dias sin contacto': { type: 'formula', formula: { type: 'number', number: 5 } },
    },
  };

  const record = mapPageToRecord(page);

  expect(record).toEqual({
    id: 'page-123',
    Nombre: 'Restaurante A',
    Notas: 'Nota larga',
    Etapa: 'Cliente Activo',
    'Sin seleccion': null,
    'Modulos activos': ['Modulo 1 Reservas'],
    'Contrato firmado': true,
    'Monto mensual': 150000,
    'Proximo seguimiento': '2026-09-15',
    'Sin fecha': null,
    'Teléfono': '+56912345678',
    Email: 'contacto@restaurante.cl',
    'Grupo / Cliente matriz': ['page-999'],
    'Dias sin contacto': 5,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/notion-map.test.js`
Expected: FAIL with "Cannot find module '../lib/notion-map'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/notion-map.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/notion-map.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add lib/notion-map.js tests/notion-map.test.js
git commit -m "Add Notion page-to-record mapper covering all Control Tower field types"
```

---

### Task 6: `lib/notion-client.js` — Notion API wrapper with pagination

**Files:**
- Create: `lib/notion-client.js`
- Test: `tests/notion-client.test.js`

**Interfaces:**
- Consumes: `@notionhq/client`'s `Client` (installed in Task 1).
- Produces: `getClient(): Client`, `queryAllPages(client, databaseId): Promise<object[]>`, `fetchPage(client, pageId): Promise<object>` — used by Tasks 9, 10, 11.

- [ ] **Step 1: Write the failing test**

```js
// tests/notion-client.test.js
const { queryAllPages, fetchPage } = require('../lib/notion-client');

function makeFakeClient(pagesByCursor) {
  return {
    databases: {
      query: jest.fn(({ start_cursor }) => Promise.resolve(pagesByCursor[start_cursor || 'first'])),
    },
    pages: {
      retrieve: jest.fn(({ page_id }) => Promise.resolve({ id: page_id })),
    },
  };
}

test('queryAllPages follows pagination until has_more is false', async () => {
  const client = makeFakeClient({
    first: { results: [{ id: 'a' }, { id: 'b' }], has_more: true, next_cursor: 'cursor-2' },
    'cursor-2': { results: [{ id: 'c' }], has_more: false, next_cursor: null },
  });

  const pages = await queryAllPages(client, 'db-1');

  expect(pages.map((p) => p.id)).toEqual(['a', 'b', 'c']);
  expect(client.databases.query).toHaveBeenCalledTimes(2);
});

test('fetchPage retrieves a single page by id', async () => {
  const client = makeFakeClient({});
  const page = await fetchPage(client, 'page-42');
  expect(page).toEqual({ id: 'page-42' });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/notion-client.test.js`
Expected: FAIL with "Cannot find module '../lib/notion-client'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/notion-client.js
const { Client } = require('@notionhq/client');

function getClient() {
  return new Client({ auth: process.env.NOTION_TOKEN });
}

async function queryAllPages(client, databaseId) {
  const pages = [];
  let cursor;
  do {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return pages;
}

async function fetchPage(client, pageId) {
  return client.pages.retrieve({ page_id: pageId });
}

module.exports = { getClient, queryAllPages, fetchPage };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/notion-client.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/notion-client.js tests/notion-client.test.js
git commit -m "Add Notion API client wrapper with pagination"
```

---

### Task 7: `lib/auth.js` + `lib/require-auth.js` — password session

**Files:**
- Create: `lib/auth.js`
- Create: `lib/require-auth.js`
- Test: `tests/auth.test.js`
- Test: `tests/require-auth.test.js`

**Interfaces:**
- Produces: `createSessionToken(secret, ttlMs?): string`, `verifySessionToken(secret, token): boolean`, `parseCookies(cookieHeader): object`, `isAuthenticated(req): boolean` — used by Tasks 8, 9, 10, 11.

- [ ] **Step 1: Write the failing test for `lib/auth.js`**

```js
// tests/auth.test.js
const { createSessionToken, verifySessionToken } = require('../lib/auth');

test('a freshly created token is valid', () => {
  const token = createSessionToken('secret-1');
  expect(verifySessionToken('secret-1', token)).toBe(true);
});

test('a token signed with a different secret is invalid', () => {
  const token = createSessionToken('secret-1');
  expect(verifySessionToken('secret-2', token)).toBe(false);
});

test('an expired token is invalid', () => {
  const token = createSessionToken('secret-1', -1000);
  expect(verifySessionToken('secret-1', token)).toBe(false);
});

test('a tampered token is invalid', () => {
  const token = createSessionToken('secret-1');
  const tampered = token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a');
  expect(verifySessionToken('secret-1', tampered)).toBe(false);
});

test('malformed or missing tokens are invalid', () => {
  expect(verifySessionToken('secret-1', undefined)).toBe(false);
  expect(verifySessionToken('secret-1', '')).toBe(false);
  expect(verifySessionToken('secret-1', 'not-a-real-token')).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/auth.test.js`
Expected: FAIL with "Cannot find module '../lib/auth'"

- [ ] **Step 3: Write minimal implementation of `lib/auth.js`**

```js
// lib/auth.js
const crypto = require('crypto');

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

function createSessionToken(secret, ttlMs = THIRTY_DAYS_MS) {
  const expiresAt = String(Date.now() + ttlMs);
  const hmac = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  return `${expiresAt}.${hmac}`;
}

function verifySessionToken(secret, token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expiresAt, hmac] = token.split('.');
  if (!/^\d+$/.test(expiresAt) || !/^[0-9a-f]{64}$/.test(hmac)) return false;
  const expected = crypto.createHmac('sha256', secret).update(expiresAt).digest('hex');
  const signatureValid = crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
  return signatureValid && Number(expiresAt) > Date.now();
}

module.exports = { createSessionToken, verifySessionToken };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/auth.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: Write the failing test for `lib/require-auth.js`**

```js
// tests/require-auth.test.js
const { createSessionToken } = require('../lib/auth');
const { parseCookies, isAuthenticated } = require('../lib/require-auth');

test('parseCookies splits a cookie header into a map', () => {
  expect(parseCookies('session=abc; other=xyz')).toEqual({ session: 'abc', other: 'xyz' });
});

test('parseCookies returns empty object for missing header', () => {
  expect(parseCookies(undefined)).toEqual({});
});

test('isAuthenticated is true with a valid session cookie', () => {
  process.env.SESSION_SECRET = 'test-secret';
  const token = createSessionToken('test-secret');
  const req = { headers: { cookie: `session=${token}` } };
  expect(isAuthenticated(req)).toBe(true);
});

test('isAuthenticated is false with no cookie', () => {
  process.env.SESSION_SECRET = 'test-secret';
  expect(isAuthenticated({ headers: {} })).toBe(false);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/require-auth.test.js`
Expected: FAIL with "Cannot find module '../lib/require-auth'"

- [ ] **Step 7: Write minimal implementation of `lib/require-auth.js`**

```js
// lib/require-auth.js
const { verifySessionToken } = require('./auth');

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((pair) => {
    const [key, ...rest] = pair.trim().split('=');
    cookies[key] = rest.join('=');
  });
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return verifySessionToken(process.env.SESSION_SECRET, cookies.session);
}

module.exports = { parseCookies, isAuthenticated };
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/require-auth.test.js`
Expected: PASS (4 tests)

- [ ] **Step 9: Commit**

```bash
git add lib/auth.js lib/require-auth.js tests/auth.test.js tests/require-auth.test.js
git commit -m "Add HMAC-signed session tokens and cookie-based auth check"
```

---

### Task 8: `api/login.js` — password login endpoint

**Files:**
- Create: `api/login.js`

**Interfaces:**
- Consumes: `createSessionToken` from Task 7.
- Produces: `POST /api/login` — sets an httpOnly `session` cookie on success.

- [ ] **Step 1: Write the implementation**

```js
// api/login.js
const { createSessionToken } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { password } = req.body || {};
  if (!password || password !== process.env.DASHBOARD_PASSWORD) {
    res.status(401).json({ error: 'Password incorrecta' });
    return;
  }

  const token = createSessionToken(process.env.SESSION_SECRET);
  res.setHeader(
    'Set-Cookie',
    `session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=2592000`
  );
  res.status(200).json({ ok: true });
};
```

- [ ] **Step 2: Manual verification with `vercel dev`**

Copy `.env.example` to `.env` and fill in real values (see Task 16 for how to get `NOTION_TOKEN`; for now any placeholder is fine to test login alone since this endpoint does not touch Notion).

Run: `npm run dev`, then in another terminal:
```bash
curl -i -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{"password":"wrong"}'
```
Expected: `HTTP/1.1 401` with `{"error":"Password incorrecta"}`.

```bash
curl -i -X POST http://localhost:3000/api/login -H 'Content-Type: application/json' -d '{"password":"'"$DASHBOARD_PASSWORD"'"}'
```
Expected: `HTTP/1.1 200`, response includes a `Set-Cookie: session=...` header.

- [ ] **Step 3: Commit**

```bash
git add api/login.js
git commit -m "Add password login endpoint issuing signed session cookie"
```

---

### Task 9: Portfolio endpoint (`lib/portfolio.js` + `api/portfolio.js`)

**Files:**
- Create: `lib/portfolio.js`
- Create: `api/portfolio.js`
- Test: `tests/portfolio.test.js`

**Interfaces:**
- Consumes: `excludeGroups` (Task 2), `getUrgencyLevel` (Task 3), `isAuthenticated` (Task 7), `getClient`/`queryAllPages` (Task 6), `mapPageToRecord` (Task 5).
- Produces: `GET /api/portfolio` → JSON array of `{ id, Nombre, 'Grupo / Cliente matriz', grupoNombre, Etapa, Tier, 'Ultimo contacto', 'Proximo seguimiento', 'Monto mensual', Moneda, 'Contrato firmado', 'En riesgo', 'Contacto principal', 'Teléfono', urgencia }`.

- [ ] **Step 1: Write the failing test for `lib/portfolio.js`**

```js
// tests/portfolio.test.js
const { buildPortfolio, PORTFOLIO_FIELDS } = require('../lib/portfolio');

test('excludes groups, resolves grupoNombre via relation, and tags urgencia', () => {
  const records = [
    { id: 'g1', Nombre: 'Holding X', 'Tipo de ficha': 'Grupo' },
    {
      id: 'c1',
      Nombre: 'Restaurante A',
      'Tipo de ficha': 'Marca',
      'Grupo / Cliente matriz': ['g1'],
      Etapa: 'Cliente Activo',
      Tier: 'Tier 1',
      'Proximo seguimiento': '2026-09-01',
      'En riesgo': false,
    },
    {
      id: 'c2',
      Nombre: 'Restaurante B',
      'Tipo de ficha': 'Independiente',
      'Grupo / Cliente matriz': [],
      Etapa: 'Nuevo Lead',
      Tier: 'Tier 3',
      'Proximo seguimiento': '2026-09-20',
      'En riesgo': false,
    },
  ];

  const result = buildPortfolio(records, '2026-09-09');

  expect(result).toHaveLength(2);
  expect(result[0]).toMatchObject({ id: 'c1', grupoNombre: 'Holding X', urgencia: 'overdue' });
  expect(result[1]).toMatchObject({ id: 'c2', grupoNombre: null, urgencia: 'ok' });
});

test('PORTFOLIO_FIELDS includes the columns defined in the design spec', () => {
  expect(PORTFOLIO_FIELDS).toEqual(
    expect.arrayContaining(['Etapa', 'Tier', 'Ultimo contacto', 'Proximo seguimiento', 'Monto mensual', 'En riesgo'])
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/portfolio.test.js`
Expected: FAIL with "Cannot find module '../lib/portfolio'"

- [ ] **Step 3: Write minimal implementation of `lib/portfolio.js`**

```js
// lib/portfolio.js
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/portfolio.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Write `api/portfolio.js`**

```js
// api/portfolio.js
const { isAuthenticated } = require('../lib/require-auth');
const { getClient, queryAllPages } = require('../lib/notion-client');
const { mapPageToRecord } = require('../lib/notion-map');
const { buildPortfolio } = require('../lib/portfolio');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const client = getClient();
  const pages = await queryAllPages(client, process.env.NOTION_DATABASE_ID);
  const records = pages.map(mapPageToRecord);
  const today = new Date().toISOString().slice(0, 10);

  res.status(200).json(buildPortfolio(records, today));
};
```

- [ ] **Step 6: Manual verification with `vercel dev`**

With `.env` filled with real `NOTION_TOKEN`/`NOTION_DATABASE_ID` (see Task 16), run `npm run dev`, log in via `/api/login` to capture the `session` cookie, then:

```bash
curl -s http://localhost:3000/api/portfolio -H "Cookie: session=$SESSION_TOKEN" | head -c 500
```
Expected: a JSON array of client/lead records (not the raw Notion page shape), with no `Tipo de ficha: "Grupo"` entries.

- [ ] **Step 7: Commit**

```bash
git add lib/portfolio.js api/portfolio.js tests/portfolio.test.js
git commit -m "Add /api/portfolio endpoint with group-relation resolution and urgency tags"
```

---

### Task 10: Ficha Cliente endpoint (`lib/client-view.js` + `api/client.js`)

**Files:**
- Create: `lib/client-view.js`
- Create: `api/client.js`
- Test: `tests/client-view.test.js`

**Interfaces:**
- Consumes: `isAuthenticated` (Task 7), `getClient`/`fetchPage` (Task 6), `mapPageToRecord` (Task 5).
- Produces: `GET /api/client?id=<pageId>` → `{ header, tabs: { infoGeneral, fichaGoogle, pruebaPago, facturacion, historial } }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/client-view.test.js
const { buildClientView } = require('../lib/client-view');

test('builds header, tabs, and flags missing Ficha Google / Facturación data', () => {
  const record = {
    id: 'c1',
    Nombre: 'Restaurante A',
    'Contacto principal': 'Juan Pérez',
    Etapa: 'Cliente Activo',
    'Proximo seguimiento': '2026-09-15',
    'Tipo de negocio': 'Restaurant',
    'Canal origen': 'Instagram',
    Comuna: 'Providencia',
    Region: 'RM',
    Ejecutivo: 'Ivan',
    'Numero de locales': 2,
    'Teléfono': '+56911111111',
    Email: 'juan@restaurantea.cl',
    'Fecha inicio prueba': '2026-06-01',
    'Fecha inicio contrato': '2026-07-01',
    'Contrato firmado': true,
    'Monto mensual': 150000,
    Moneda: 'CLP',
    RUT: null,
    'Razon social': null,
    'Fecha primer contacto': '2026-05-20',
    'Ultimo contacto': '2026-09-01',
    'En riesgo': false,
  };

  const view = buildClientView(record, {});

  expect(view.header).toEqual({
    nombre: 'Restaurante A',
    contactoPrincipal: 'Juan Pérez',
    etapa: 'Cliente Activo',
    proximoSeguimiento: '2026-09-15',
  });
  expect(view.tabs.fichaGoogle).toEqual({ sinDatos: true });
  expect(view.tabs.facturacion).toMatchObject({ rut: null, razonSocial: null, sinDatos: true });
  expect(view.tabs.infoGeneral).toMatchObject({ tipoDeNegocio: 'Restaurant', comuna: 'Providencia' });
  expect(view.tabs.pruebaPago).toMatchObject({ contratoFirmado: true, montoMensual: 150000, moneda: 'CLP' });
  expect(view.tabs.historial).toMatchObject({ fechaPrimerContacto: '2026-05-20', ultimoContacto: '2026-09-01' });
});

test('resolves grupoNombre from the relatedNames map when a group relation exists', () => {
  const record = { id: 'c1', Nombre: 'Restaurante A', 'Grupo / Cliente matriz': ['g1'] };
  const view = buildClientView(record, { g1: 'Holding X' });
  expect(view.tabs.infoGeneral.grupoNombre).toBe('Holding X');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/client-view.test.js`
Expected: FAIL with "Cannot find module '../lib/client-view'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/client-view.js
function buildClientView(record, relatedNames) {
  const groupIds = record['Grupo / Cliente matriz'] || [];
  const grupoNombre = groupIds.length
    ? groupIds.map((id) => relatedNames[id]).filter(Boolean).join(', ') || null
    : null;

  return {
    header: {
      nombre: record['Nombre'] || null,
      contactoPrincipal: record['Contacto principal'] || null,
      etapa: record['Etapa'] || null,
      proximoSeguimiento: record['Proximo seguimiento'] || null,
    },
    tabs: {
      infoGeneral: {
        tipoDeNegocio: record['Tipo de negocio'] || null,
        canalOrigen: record['Canal origen'] || null,
        fuenteDelLead: record['Fuente del lead'] || null,
        comuna: record['Comuna'] || null,
        region: record['Region'] || null,
        ejecutivo: record['Ejecutivo'] || null,
        numeroDeLocales: record['Numero de locales'] ?? null,
        telefono: record['Teléfono'] || null,
        telefono2: record['Teléfono 2'] || null,
        email: record['Email'] || null,
        email2: record['Email 2'] || null,
        cargo: record['Cargo'] || null,
        notas: record['Notas'] || null,
        grupoNombre,
      },
      fichaGoogle: { sinDatos: true },
      pruebaPago: {
        fechaInicioPrueba: record['Fecha inicio prueba'] || null,
        fechaInicioContrato: record['Fecha inicio contrato'] || null,
        fechaRenovacion: record['Fecha renovacion'] || null,
        contratoFirmado: record['Contrato firmado'] === true,
        montoMensual: record['Monto mensual'] ?? null,
        moneda: record['Moneda'] || null,
        modulosActivos: record['Modulos activos'] || [],
        estadoComercial: record['Estado comercial'] || null,
      },
      facturacion: {
        rut: record['RUT'] || null,
        razonSocial: record['Razon social'] || null,
        direccionLegal: record['Direccion legal'] || null,
        giro: record['Giro'] || null,
        sinDatos: !record['RUT'] && !record['Razon social'],
      },
      historial: {
        fechaPrimerContacto: record['Fecha primer contacto'] || null,
        fechaIngresoPipeline: record['Fecha ingreso pipeline'] || null,
        ultimoContacto: record['Ultimo contacto'] || null,
        ultimaReunion: record['Ultima reunion'] || null,
        fechaOnboardingCompletado: record['Fecha onboarding completado'] || null,
        fechaChurn: record['Fecha churn'] || null,
        motivoChurn: record['Motivo churn'] || null,
        motivoPerdida: record['Motivo perdida'] || null,
        enRiesgo: record['En riesgo'] === true,
      },
    },
  };
}

module.exports = { buildClientView };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/client-view.test.js`
Expected: PASS (2 tests)

- [ ] **Step 5: Write `api/client.js`**

```js
// api/client.js
const { isAuthenticated } = require('../lib/require-auth');
const { getClient, fetchPage } = require('../lib/notion-client');
const { mapPageToRecord } = require('../lib/notion-map');
const { buildClientView } = require('../lib/client-view');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const { id } = req.query;
  if (!id) {
    res.status(400).json({ error: 'Falta el parametro id' });
    return;
  }

  const client = getClient();
  const page = await fetchPage(client, id);
  const record = mapPageToRecord(page);

  const groupIds = record['Grupo / Cliente matriz'] || [];
  const relatedNames = {};
  for (const groupId of groupIds) {
    const relatedPage = await fetchPage(client, groupId);
    relatedNames[groupId] = mapPageToRecord(relatedPage)['Nombre'];
  }

  res.status(200).json(buildClientView(record, relatedNames));
};
```

- [ ] **Step 6: Manual verification with `vercel dev`**

```bash
curl -s "http://localhost:3000/api/client?id=<un-page-id-real>" -H "Cookie: session=$SESSION_TOKEN" | head -c 500
```
Expected: JSON with `header` and `tabs` keys populated from a real Control Tower record.

- [ ] **Step 7: Commit**

```bash
git add lib/client-view.js api/client.js tests/client-view.test.js
git commit -m "Add /api/client endpoint with header/tabs view model"
```

---

### Task 11: Resumen Ejecutivo endpoint (`lib/summary.js` + `api/summary.js`)

**Files:**
- Create: `lib/summary.js`
- Create: `api/summary.js`
- Test: `tests/summary.test.js`

**Interfaces:**
- Consumes: `excludeGroups` (Task 2), aggregate functions (Task 4), `isAuthenticated` (Task 7), `getClient`/`queryAllPages` (Task 6), `mapPageToRecord` (Task 5).
- Produces: `GET /api/summary` → `{ mrr, pipelinePorEtapa, distribucionPorTier, enRiesgo, churn, conversion }`.

- [ ] **Step 1: Write the failing test**

```js
// tests/summary.test.js
const { buildSummary } = require('../lib/summary');

test('composes filters + aggregates into a single summary, excluding groups', () => {
  const records = [
    { id: 'g1', 'Tipo de ficha': 'Grupo' },
    { id: 'c1', 'Tipo de ficha': 'Independiente', Etapa: 'Cliente Activo', Tier: 'Tier 1', 'Contrato firmado': true, Moneda: 'CLP', 'Monto mensual': 100000, 'En riesgo': false },
    { id: 'c2', 'Tipo de ficha': 'Independiente', Etapa: 'Churn', Tier: 'Tier 2', 'Contrato firmado': false, 'Motivo churn': 'Precio', 'En riesgo': false },
  ];

  const summary = buildSummary(records);

  expect(summary.mrr).toEqual({ CLP: 100000, UF: 0 });
  expect(summary.pipelinePorEtapa).toEqual({ 'Cliente Activo': 1, Churn: 1 });
  expect(summary.distribucionPorTier).toEqual({ 'Tier 1': 1, 'Tier 2': 1, 'Tier 3': 0 });
  expect(summary.enRiesgo).toBe(0);
  expect(summary.churn).toEqual({ total: 1, byMotivo: { Precio: 1 } });
  expect(summary.conversion).toBe(0.5);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/summary.test.js`
Expected: FAIL with "Cannot find module '../lib/summary'"

- [ ] **Step 3: Write minimal implementation**

```js
// lib/summary.js
const { excludeGroups } = require('./filters');
const {
  computeMRR,
  groupByEtapa,
  groupByTier,
  countAtRisk,
  countChurn,
  computeConversion,
} = require('./aggregate');

function buildSummary(records) {
  const filtered = excludeGroups(records);
  return {
    mrr: computeMRR(filtered),
    pipelinePorEtapa: groupByEtapa(filtered),
    distribucionPorTier: groupByTier(filtered),
    enRiesgo: countAtRisk(filtered),
    churn: countChurn(filtered),
    conversion: computeConversion(filtered),
  };
}

module.exports = { buildSummary };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/summary.test.js`
Expected: PASS (1 test)

- [ ] **Step 5: Write `api/summary.js`**

```js
// api/summary.js
const { isAuthenticated } = require('../lib/require-auth');
const { getClient, queryAllPages } = require('../lib/notion-client');
const { mapPageToRecord } = require('../lib/notion-map');
const { buildSummary } = require('../lib/summary');

module.exports = async function handler(req, res) {
  if (!isAuthenticated(req)) {
    res.status(401).json({ error: 'No autenticado' });
    return;
  }

  const client = getClient();
  const pages = await queryAllPages(client, process.env.NOTION_DATABASE_ID);
  const records = pages.map(mapPageToRecord);

  res.status(200).json(buildSummary(records));
};
```

- [ ] **Step 6: Manual verification with `vercel dev`**

```bash
curl -s http://localhost:3000/api/summary -H "Cookie: session=$SESSION_TOKEN"
```
Expected: JSON with `mrr`, `pipelinePorEtapa`, `distribucionPorTier`, `enRiesgo`, `churn`, `conversion` matching what you'd expect from eyeballing the real Control Tower.

- [ ] **Step 7: Commit**

```bash
git add lib/summary.js api/summary.js tests/summary.test.js
git commit -m "Add /api/summary endpoint for the executive report"
```

---

### Task 12: Shared frontend + login page

**Files:**
- Create: `styles.css`
- Create: `app.js`
- Create: `index.html`

**Interfaces:**
- Produces: `escapeHtml(str)`, `apiFetch(path, options?)` (in `app.js`, attached to `window.AyHungryCRM`) — used by Tasks 13, 14, 15.

- [ ] **Step 1: Create `styles.css`**

```css
:root {
  color-scheme: light;
  --bg: #f7f7f5;
  --panel: #ffffff;
  --text: #1f2320;
  --muted: #6b7268;
  --border: #e3e5e0;
  --overdue: #c0392b;
  --at-risk: #d97706;
  --ok: #2f7d4f;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 24px;
}

.panel {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
}

table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid var(--border); font-size: 14px; }
th { color: var(--muted); font-weight: 600; }

tr.urgency-overdue { background: rgba(192, 57, 43, 0.08); }
tr.urgency-at-risk { background: rgba(217, 119, 6, 0.08); }

.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 600; }
.badge-overdue { background: var(--overdue); color: white; }
.badge-at-risk { background: var(--at-risk); color: white; }
.badge-ok { background: var(--ok); color: white; }

.client-header {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 16px;
  margin-bottom: 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel);
}
.client-header div { min-width: 160px; }
.client-header .label { color: var(--muted); font-size: 12px; text-transform: uppercase; }
.client-header .value { font-size: 16px; font-weight: 600; }

.tabs { display: flex; gap: 4px; border-bottom: 1px solid var(--border); margin-bottom: 12px; }
.tab-button { padding: 8px 14px; border: none; background: none; cursor: pointer; font-size: 14px; color: var(--muted); }
.tab-button.active { color: var(--text); border-bottom: 2px solid var(--text); font-weight: 600; }
.tab-panel { display: none; }
.tab-panel.active { display: block; }

.empty-state { color: var(--muted); font-style: italic; }

input[type="text"], input[type="password"], select {
  padding: 8px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  font-size: 14px;
}

button.primary {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  background: var(--text);
  color: white;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `app.js`**

```js
// app.js
(function () {
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function apiFetch(path, options) {
    const response = await fetch(path, { credentials: 'same-origin', ...options });
    if (response.status === 401) {
      window.location.href = '/index.html';
      throw new Error('No autenticado');
    }
    if (!response.ok) {
      throw new Error(`Error ${response.status} en ${path}`);
    }
    return response.json();
  }

  window.AyHungryCRM = { escapeHtml, apiFetch };
})();
```

- [ ] **Step 3: Create `index.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AyHungry CRM — Ingreso</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="page" style="max-width: 360px; margin-top: 15vh;">
    <div class="panel">
      <h1 style="font-size: 18px;">AyHungry CRM</h1>
      <form id="login-form">
        <input type="password" id="password" placeholder="Contraseña" style="width: 100%; margin-bottom: 12px;" />
        <button type="submit" class="primary" style="width: 100%;">Entrar</button>
        <p id="error" style="color: #c0392b; font-size: 13px; display: none;"></p>
      </form>
    </div>
  </div>
  <script src="app.js"></script>
  <script>
    document.getElementById('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('error');
      errorEl.style.display = 'none';
      try {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (!response.ok) throw new Error('bad credentials');
        window.location.href = '/portfolio.html';
      } catch (e) {
        errorEl.textContent = 'Contraseña incorrecta';
        errorEl.style.display = 'block';
      }
    });
  </script>
</body>
</html>
```

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open `http://localhost:3000/index.html` in a browser, submit the wrong password (see the error message), then the real `DASHBOARD_PASSWORD` (redirects to `/portfolio.html`, which returns 404 until Task 13 — that 404 is expected here).

- [ ] **Step 5: Commit**

```bash
git add styles.css app.js index.html
git commit -m "Add shared styles/JS helpers and login page"
```

---

### Task 13: Portafolio page

**Files:**
- Create: `portfolio.html`

- [ ] **Step 1: Create `portfolio.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AyHungry CRM — Portafolio</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="page">
    <h1>Portafolio</h1>
    <div style="display:flex; gap:8px; margin-bottom:12px;">
      <input type="text" id="search" placeholder="Buscar por nombre..." />
      <select id="filter-etapa"><option value="">Todas las etapas</option></select>
      <select id="filter-tier">
        <option value="">Todos los tiers</option>
        <option value="Tier 1">Tier 1</option>
        <option value="Tier 2">Tier 2</option>
        <option value="Tier 3">Tier 3</option>
      </select>
    </div>
    <div class="panel">
      <table>
        <thead>
          <tr>
            <th>Etapa</th><th>Tier</th><th>Último contacto</th><th>Próximo seguimiento</th>
            <th>Monto mensual</th><th>En riesgo</th><th>Nombre</th><th>Grupo</th><th>Contacto</th>
          </tr>
        </thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
  </div>
  <script src="app.js"></script>
  <script>
    const { escapeHtml, apiFetch } = window.AyHungryCRM;
    let allRows = [];

    function urgencyBadge(urgencia) {
      const labels = { overdue: 'Vencido', 'at-risk': 'En riesgo', ok: 'OK' };
      return `<span class="badge badge-${urgencia}">${labels[urgencia]}</span>`;
    }

    function formatMonto(monto, moneda) {
      if (monto === null || monto === undefined) return '—';
      return `${monto.toLocaleString('es-CL')} ${moneda || ''}`.trim();
    }

    function render(rows) {
      const tbody = document.getElementById('rows');
      tbody.innerHTML = rows
        .map((r) => `
          <tr class="urgency-${r.urgencia}">
            <td>${escapeHtml(r['Etapa'])}</td>
            <td>${escapeHtml(r['Tier'])}</td>
            <td>${escapeHtml(r['Ultimo contacto'])}</td>
            <td>${escapeHtml(r['Proximo seguimiento'])}</td>
            <td>${formatMonto(r['Monto mensual'], r['Moneda'])}</td>
            <td>${urgencyBadge(r.urgencia)}</td>
            <td><a href="client.html?id=${encodeURIComponent(r.id)}">${escapeHtml(r['Nombre'])}</a></td>
            <td>${escapeHtml(r.grupoNombre)}</td>
            <td>${escapeHtml(r['Teléfono'])}</td>
          </tr>
        `)
        .join('');
    }

    function applyFilters() {
      const search = document.getElementById('search').value.toLowerCase();
      const etapa = document.getElementById('filter-etapa').value;
      const tier = document.getElementById('filter-tier').value;
      const filtered = allRows.filter((r) => {
        const matchesSearch = !search || (r['Nombre'] || '').toLowerCase().includes(search);
        const matchesEtapa = !etapa || r['Etapa'] === etapa;
        const matchesTier = !tier || r['Tier'] === tier;
        return matchesSearch && matchesEtapa && matchesTier;
      });
      render(filtered);
    }

    function populateEtapaFilter(rows) {
      const etapas = [...new Set(rows.map((r) => r['Etapa']).filter(Boolean))].sort();
      const select = document.getElementById('filter-etapa');
      for (const etapa of etapas) {
        const option = document.createElement('option');
        option.value = etapa;
        option.textContent = etapa;
        select.appendChild(option);
      }
    }

    document.getElementById('search').addEventListener('input', applyFilters);
    document.getElementById('filter-etapa').addEventListener('change', applyFilters);
    document.getElementById('filter-tier').addEventListener('change', applyFilters);

    apiFetch('/api/portfolio').then((rows) => {
      allRows = rows;
      populateEtapaFilter(rows);
      render(rows);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

With `npm run dev` running and logged in, open `http://localhost:3000/portfolio.html`. Confirm: rows load from real Notion data, overdue rows are visibly tinted/badged, search and both filters narrow the table, clicking a name navigates to `client.html?id=...` (404 expected until Task 14).

- [ ] **Step 3: Commit**

```bash
git add portfolio.html
git commit -m "Add Portafolio view with search, filters, and urgency badges"
```

---

### Task 14: Ficha Cliente page

**Files:**
- Create: `client.html`

- [ ] **Step 1: Create `client.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AyHungry CRM — Ficha Cliente</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="page">
    <p><a href="portfolio.html">&larr; Volver al portafolio</a></p>
    <div class="client-header" id="header"></div>
    <div class="tabs" id="tabs"></div>
    <div id="panels"></div>
  </div>
  <script src="app.js"></script>
  <script>
    const { escapeHtml, apiFetch } = window.AyHungryCRM;

    const TAB_LABELS = {
      infoGeneral: 'Info General',
      fichaGoogle: 'Ficha Google',
      pruebaPago: 'Prueba / Pago',
      facturacion: 'Facturación',
      historial: 'Historial',
    };

    function renderHeader(header) {
      document.getElementById('header').innerHTML = `
        <div><div class="label">Nombre</div><div class="value">${escapeHtml(header.nombre)}</div></div>
        <div><div class="label">Contacto principal</div><div class="value">${escapeHtml(header.contactoPrincipal) || '—'}</div></div>
        <div><div class="label">Etapa</div><div class="value">${escapeHtml(header.etapa)}</div></div>
        <div><div class="label">Próxima acción</div><div class="value">${escapeHtml(header.proximoSeguimiento) || 'Sin fecha'}</div></div>
      `;
    }

    function renderFields(obj) {
      if (obj.sinDatos) return '<p class="empty-state">Sin datos.</p>';
      const rows = Object.entries(obj)
        .filter(([key]) => key !== 'sinDatos')
        .map(([key, value]) => {
          const display = Array.isArray(value) ? value.join(', ') : value;
          return `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(display) || '—'}</td></tr>`;
        })
        .join('');
      return `<table>${rows}</table>`;
    }

    function renderTabs(tabs) {
      const tabsEl = document.getElementById('tabs');
      const panelsEl = document.getElementById('panels');
      const keys = Object.keys(TAB_LABELS);

      tabsEl.innerHTML = keys
        .map((key, i) => `<button class="tab-button${i === 0 ? ' active' : ''}" data-tab="${key}">${TAB_LABELS[key]}</button>`)
        .join('');
      panelsEl.innerHTML = keys
        .map((key, i) => `<div class="tab-panel${i === 0 ? ' active' : ''}" data-panel="${key}">${renderFields(tabs[key])}</div>`)
        .join('');

      tabsEl.querySelectorAll('.tab-button').forEach((button) => {
        button.addEventListener('click', () => {
          tabsEl.querySelectorAll('.tab-button').forEach((b) => b.classList.remove('active'));
          panelsEl.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
          button.classList.add('active');
          panelsEl.querySelector(`[data-panel="${button.dataset.tab}"]`).classList.add('active');
        });
      });
    }

    const id = new URLSearchParams(window.location.search).get('id');
    apiFetch(`/api/client?id=${encodeURIComponent(id)}`).then(({ header, tabs }) => {
      renderHeader(header);
      renderTabs(tabs);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

From `portfolio.html`, click a client name. Confirm: header (nombre/contacto/etapa/próxima acción) is always visible, the 5 tabs switch correctly, "Ficha Google" and (for clients without RUT) "Facturación" show "Sin datos." instead of empty tables.

- [ ] **Step 3: Commit**

```bash
git add client.html
git commit -m "Add Ficha Cliente view with always-visible header and tabbed detail"
```

---

### Task 15: Resumen Ejecutivo page

**Files:**
- Create: `resumen.html`

- [ ] **Step 1: Create `resumen.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AyHungry CRM — Resumen Ejecutivo</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <div class="page">
    <p><a href="portfolio.html">&larr; Volver al portafolio</a></p>
    <h1>Resumen Ejecutivo</h1>
    <div id="content"></div>
  </div>
  <script src="app.js"></script>
  <script>
    const { escapeHtml, apiFetch } = window.AyHungryCRM;

    function formatCurrencyTotals(totals) {
      const parts = [];
      if (totals.CLP) parts.push(`$${totals.CLP.toLocaleString('es-CL')} CLP`);
      if (totals.UF) parts.push(`${totals.UF.toLocaleString('es-CL')} UF`);
      return parts.length ? parts.join(' + ') : 'Sin contratos firmados';
    }

    function renderCounts(title, counts) {
      const rows = Object.entries(counts)
        .map(([label, count]) => `<tr><th>${escapeHtml(label)}</th><td>${count}</td></tr>`)
        .join('');
      return `<div class="panel" style="margin-bottom:16px;"><h2 style="font-size:15px;">${title}</h2><table>${rows}</table></div>`;
    }

    apiFetch('/api/summary').then((summary) => {
      const content = document.getElementById('content');
      content.innerHTML = `
        <div class="panel" style="margin-bottom:16px;">
          <h2 style="font-size:15px;">MRR</h2>
          <p style="font-size:22px; font-weight:700;">${formatCurrencyTotals(summary.mrr)}</p>
        </div>
        ${renderCounts('Pipeline por etapa', summary.pipelinePorEtapa)}
        ${renderCounts('Distribución por Tier', summary.distribucionPorTier)}
        <div class="panel" style="margin-bottom:16px;">
          <h2 style="font-size:15px;">Clientes en riesgo</h2>
          <p style="font-size:22px; font-weight:700;">${summary.enRiesgo}</p>
        </div>
        <div class="panel" style="margin-bottom:16px;">
          <h2 style="font-size:15px;">Conversión leads → clientes</h2>
          <p style="font-size:22px; font-weight:700;">${(summary.conversion * 100).toFixed(1)}%</p>
        </div>
        ${summary.churn.total > 0 ? renderCounts(`Churn (${summary.churn.total} total)`, summary.churn.byMotivo)
          : '<div class="panel"><h2 style="font-size:15px;">Churn</h2><p class="empty-state">Sin registros de churn todavía.</p></div>'}
      `;
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Manual verification**

Open `http://localhost:3000/resumen.html`. Confirm every section renders with real numbers from Notion and matches a manual sanity check (e.g. count `Cliente Activo` rows in Notion directly and compare to `pipelinePorEtapa`).

- [ ] **Step 3: Commit**

```bash
git add resumen.html
git commit -m "Add Resumen Ejecutivo view for stakeholder sharing"
```

---

### Task 16: Deploy to Vercel and end-to-end smoke test

**Files:** none (infrastructure/config task)

- [ ] **Step 1: Create a Notion integration token**

In a browser, go to `https://www.notion.so/my-integrations` → "New integration" → name it "AyHungry CRM Dashboard" → copy the "Internal Integration Secret" (this is `NOTION_TOKEN`).

- [ ] **Step 2: Share the Control Tower database with the integration**

Open the Control Tower page in Notion → "..." menu → "Connections" → add the "AyHungry CRM Dashboard" integration. Without this step every API call returns 404/"not found" even with a valid token.

- [ ] **Step 3: Create the Vercel project**

Run: `npx vercel link` from the repo root, follow the prompts to create a new project linked to this GitHub repo (or run `npx vercel` for a first manual deploy).

- [ ] **Step 4: Set environment variables in Vercel**

```bash
npx vercel env add NOTION_TOKEN production
npx vercel env add NOTION_DATABASE_ID production   # value: 9baa8b5c-203f-4fa8-8742-6b3b87c79318
npx vercel env add DASHBOARD_PASSWORD production
npx vercel env add SESSION_SECRET production        # a long random string, e.g. output of `openssl rand -hex 32`
```

- [ ] **Step 5: Deploy**

Run: `npx vercel --prod`
Expected: a production URL is printed (e.g. `https://ayhungry-crm.vercel.app`).

- [ ] **Step 6: End-to-end smoke test in a real browser**

Open the production URL, log in with `DASHBOARD_PASSWORD`, confirm:
- Portafolio loads real clients/leads with correct urgency badges.
- Clicking a client opens Ficha Cliente with real data and correct "Sin datos." fallbacks.
- Resumen Ejecutivo shows numbers that match a manual spot-check in Notion.
- Opening the production URL in a private/incognito window without logging in redirects to the login page for every protected view.

- [ ] **Step 7: Commit the Vercel project link file if one was created**

```bash
git status
# if .vercel/project.json exists, it is already gitignored (Task 1) — confirm nothing sensitive was staged
git add -A
git commit -m "Note: v1 dashboard deployed to Vercel" --allow-empty
```
