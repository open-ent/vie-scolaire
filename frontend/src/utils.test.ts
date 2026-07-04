import { describe, expect, it } from 'vitest';

import { byName, compareFr, decoupageAnnee, formatDate, periodeLabel, resolveName, ymd } from './utils';

describe('resolveName', () => {
  const table = new Map([['a', 'Alpha'], ['b', 'Bravo']]);
  it('résout via la table, repli sur l’id brut', () => {
    expect(resolveName('a', table)).toBe('Alpha');
    expect(resolveName('z', table)).toBe('z');
  });
});

describe('compareFr', () => {
  it('trie insensible casse/accents', () => {
    expect(['Éveil', 'anglais', 'Biologie'].sort(compareFr)).toEqual(['anglais', 'Biologie', 'Éveil']);
  });
});

describe('ymd', () => {
  it('formate en YYYY-MM-DD', () => {
    expect(ymd(new Date(2026, 8, 5))).toBe('2026-09-05');
  });
});

describe('formatDate', () => {
  it('convertit ISO en jj/mm/aaaa', () => {
    expect(formatDate('2026-09-15')).toBe('15/09/2026');
    expect(formatDate('2026-09-15T00:00:00')).toBe('15/09/2026');
    // Périodes d'exclusion : format backend avec millisecondes.
    expect(formatDate('2025-11-01T00:00:00.000')).toBe('01/11/2025');
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

describe('decoupageAnnee', () => {
  const start = '2025-09-01';
  const end = '2026-07-05';

  it('produit exactement nb périodes', () => {
    expect(decoupageAnnee(3, start, end)).toHaveLength(3);
    expect(decoupageAnnee(2, start, end)).toHaveLength(2);
  });

  it('borne la 1re période au début et la dernière à la fin de l’année', () => {
    const p = decoupageAnnee(3, start, end);
    expect(p[0].timestamp_dt).toBe('2025-09-01');
    expect(p[2].timestamp_fn).toBe('2026-07-05');
  });

  it('enchaîne les périodes sans trou (fin d’une < début de la suivante)', () => {
    const p = decoupageAnnee(2, start, end);
    expect(p[0].timestamp_fn < p[1].timestamp_dt).toBe(true);
  });

  it('aligne fin de saisie et conseil sur la fin de période, bulletin non publié par défaut', () => {
    const p = decoupageAnnee(3, start, end);
    expect(p[0].date_fin_saisie).toBe(p[0].timestamp_fn);
    expect(p[0].date_conseil_classe).toBe(p[0].timestamp_fn);
    expect(p[0].publication_bulletin).toBe(false);
  });

  it('renvoie un tableau vide si l’année est inconnue', () => {
    expect(decoupageAnnee(3, undefined, end)).toEqual([]);
    expect(decoupageAnnee(3, start, undefined)).toEqual([]);
  });
});

describe('byName', () => {
  it('trie par nom, insensible casse/accents', () => {
    const arr = [{ name: 'Éveil' }, { name: 'anglais' }, { name: 'Biologie' }];
    const sorted = [...arr].sort(byName).map((x) => x.name);
    expect(sorted).toEqual(['anglais', 'Biologie', 'Éveil']);
  });
});
