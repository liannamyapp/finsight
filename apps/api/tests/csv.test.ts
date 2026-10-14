import { parseCsvLine, parseIsoDate, parseTransactionsCsv, toCents } from '../src/domain/csv';

describe('parseCsvLine', () => {
  it('splits simple lines and trims cells', () => {
    expect(parseCsvLine('a, b ,c')).toEqual(['a', 'b', 'c']);
  });

  it('handles quoted fields with commas and escaped quotes', () => {
    expect(parseCsvLine('2026-01-01,"Rent, office","He said ""hi"""')).toEqual([
      '2026-01-01',
      'Rent, office',
      'He said "hi"',
    ]);
  });

  it('keeps empty trailing cells', () => {
    expect(parseCsvLine('a,,')).toEqual(['a', '', '']);
  });
});

describe('toCents', () => {
  it.each([
    ['10', 1000],
    ['10.5', 1050],
    ['10.05', 1005],
    ['0.1', 10],
    ['$1 234.99', 123499],
  ])('converts %s to %d cents without float errors', (input, expected) => {
    expect(toCents(input)).toBe(expected);
  });

  it.each(['abc', '-5', '1.234', '', '1,5'])('rejects %s', (input) => {
    expect(toCents(input)).toBeNull();
  });
});

describe('parseIsoDate', () => {
  it('parses valid dates as UTC midnight', () => {
    expect(parseIsoDate('2026-03-15')?.toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('rejects impossible or malformed dates', () => {
    expect(parseIsoDate('2026-02-31')).toBeNull();
    expect(parseIsoDate('15.03.2026')).toBeNull();
  });
});

describe('parseTransactionsCsv', () => {
  const header = 'date,amount,type,category,description';

  it('parses valid rows (case-insensitive header and type, BOM, CRLF)', () => {
    const csv = `﻿Date,Amount,Type,Category,Description\r\n2026-01-05,1500.00,income,Subscriptions,Client A\r\n2026-01-06,99.9,EXPENSE,Software,\r\n`;
    const { rows, errors } = parseTransactionsCsv(csv);

    expect(errors).toEqual([]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ amountCents: 150000, type: 'INCOME', category: 'Subscriptions', description: 'Client A' });
    expect(rows[1]).toMatchObject({ amountCents: 9990, type: 'EXPENSE', description: null });
  });

  it('reports invalid rows with line numbers and keeps valid ones', () => {
    const csv = [
      header,
      '2026-01-05,100,INCOME,Sales,ok',
      'bad-date,100,INCOME,Sales,',
      '2026-01-07,-50,EXPENSE,Cloud,',
      '2026-01-08,50,TRANSFER,Cloud,',
      '2026-01-09,50,EXPENSE,,',
    ].join('\n');

    const { rows, errors } = parseTransactionsCsv(csv);
    expect(rows).toHaveLength(1);
    expect(errors.map((e) => e.line)).toEqual([3, 4, 5, 6]);
  });

  it('fails fast when required columns are missing', () => {
    const { rows, errors } = parseTransactionsCsv('date,amount\n2026-01-01,10');
    expect(rows).toEqual([]);
    expect(errors[0].message).toContain('type, category');
  });

  it('handles empty input', () => {
    expect(parseTransactionsCsv('  \n ').errors[0].message).toBe('File is empty');
  });
});
