/**
 * Minimal, dependency-free CSV parser for transaction imports.
 * Expected header: date,amount,type,category[,description]
 * Supports quoted fields with commas and escaped quotes ("").
 * Multi-line quoted fields are intentionally not supported.
 */
import type { TxType } from './analytics';

export type ParsedTransaction = {
  date: Date;
  amountCents: number;
  type: TxType;
  category: string;
  description: string | null;
};

export type CsvError = { line: number; message: string };

export type CsvResult = { rows: ParsedTransaction[]; errors: CsvError[] };

const REQUIRED_COLUMNS = ['date', 'amount', 'type', 'category'] as const;
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const MAX_AMOUNT_CENTS = 1_000_000_000; // $10M per transaction

export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

export function parseIsoDate(value: string): Date | null {
  if (!DATE_RE.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejects dates like 2026-02-31 that JS would silently roll over.
  return date.toISOString().slice(0, 10) === value ? date : null;
}

/** Converts a decimal string like "1234.5" to integer cents without float drift. */
export function toCents(value: string): number | null {
  const normalized = value.replace(/[\s$]/g, '');
  if (!AMOUNT_RE.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

export function parseTransactionsCsv(text: string): CsvResult {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const errors: CsvError[] = [];
  const rows: ParsedTransaction[] = [];

  const headerIndex = lines.findIndex((l) => l.trim() !== '');
  if (headerIndex === -1) return { rows, errors: [{ line: 0, message: 'File is empty' }] };

  const header = parseCsvLine(lines[headerIndex]).map((h) => h.toLowerCase());
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c));
  if (missing.length) {
    return { rows, errors: [{ line: headerIndex + 1, message: `Missing columns: ${missing.join(', ')}` }] };
  }
  const col = (name: string) => header.indexOf(name);

  for (let i = headerIndex + 1; i < lines.length; i++) {
    if (lines[i].trim() === '') continue;
    const lineNo = i + 1;
    const cells = parseCsvLine(lines[i]);
    const get = (name: string) => (col(name) >= 0 ? cells[col(name)] ?? '' : '');

    const date = parseIsoDate(get('date'));
    if (!date) {
      errors.push({ line: lineNo, message: `Invalid date "${get('date')}" (expected YYYY-MM-DD)` });
      continue;
    }
    const amountCents = toCents(get('amount'));
    if (amountCents === null || amountCents === 0 || amountCents > MAX_AMOUNT_CENTS) {
      errors.push({ line: lineNo, message: `Invalid amount "${get('amount')}" (positive number, max 2 decimals)` });
      continue;
    }
    const type = get('type').toUpperCase();
    if (type !== 'INCOME' && type !== 'EXPENSE') {
      errors.push({ line: lineNo, message: `Invalid type "${get('type')}" (INCOME or EXPENSE)` });
      continue;
    }
    const category = get('category');
    if (!category || category.length > 50) {
      errors.push({ line: lineNo, message: 'Category is required (max 50 chars)' });
      continue;
    }
    const description = get('description').slice(0, 200) || null;

    rows.push({ date, amountCents, type, category, description });
  }

  return { rows, errors };
}
