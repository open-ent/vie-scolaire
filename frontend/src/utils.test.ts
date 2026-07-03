import { describe, expect, it } from 'vitest';

import { byName, formatDate, periodeLabel, ymd } from './utils';

describe('ymd', () => {
  it('formate en YYYY-MM-DD', () => {
    expect(ymd(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('formatDate', () => {
  it('convertit ISO en jj/mm/aaaa', () => {
    expect(formatDate('2026-09-15')).toBe('15/09/2026');
    expect(formatDate('2026-09-15T00:00:00')).toBe('15/09/2026');
  });
  it('conserve un format jj/mm/aaaa déjà fourni', () => {
    expect(formatDate('01/09/2026')).toBe('01/09/2026');
  });
  it('renvoie vide sur entrée vide', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('periodeLabel', () => {
  const labels = new Map<number, string>([
    [1, 'Trimestre 1'],
    [2, 'Trimestre 2'],
  ]);
  it('résout le libellé du type', () => {
    expect(periodeLabel(1, labels)).toBe('Trimestre 1');
  });
  it('retombe sur un libellé générique si type inconnu', () => {
    expect(periodeLabel(5, labels)).toBe('Période 5');
  });
  it('gère l’absence de type', () => {
    expect(periodeLabel(undefined, labels)).toBe('—');
  });
});

describe('byName', () => {
  it('trie par nom, insensible casse/accents', () => {
    const arr = [{ name: 'Éveil' }, { name: 'anglais' }, { name: 'Biologie' }];
    const sorted = [...arr].sort(byName).map((x) => x.name);
    expect(sorted).toEqual(['anglais', 'Biologie', 'Éveil']);
  });
});
