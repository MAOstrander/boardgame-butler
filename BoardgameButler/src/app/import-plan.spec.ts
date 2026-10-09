import { RawGame } from './game';
import { planImport, planPlayerImport } from './import-plan';

const catan: RawGame = { title: 'Catan', minPlayers: 3, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120, complexity: 'Medium', rating: 7 };
const azul: RawGame = { title: 'Azul', minPlayers: 2, maxPlayers: 4, minPlaytime: 30, maxPlaytime: 45, complexity: 'Easy', rating: 9 };

describe('planImport', () => {
  it('keeps every game when there are no duplicates', () => {
    const plan = planImport([catan, azul]);
    expect(plan.kept).toEqual([catan, azul]);
    expect(plan.skipped).toBe(0);
    expect(plan.rows.map(r => r.duplicateOf)).toEqual([undefined, undefined]);
  });

  it('keeps the first occurrence of a title and skips later ones', () => {
    const again = { ...catan };
    const plan = planImport([catan, azul, again]);

    expect(plan.kept).toEqual([catan, azul]);
    expect(plan.skipped).toBe(1);
    expect(plan.rows[2]).toEqual({ game: again, duplicateOf: 'Catan', differences: [] });
  });

  it('matches titles ignoring case and surrounding whitespace, reporting the kept spelling', () => {
    const plan = planImport([catan, { ...catan, title: '  CATAN ' }, { ...catan, title: 'catan' }]);
    expect(plan.kept.length).toBe(1);
    expect(plan.skipped).toBe(2);
    expect(plan.rows[1].duplicateOf).toBe('Catan');
    expect(plan.rows[2].duplicateOf).toBe('Catan');
  });

  it('lists how a skipped row differs from the kept one', () => {
    const plan = planImport([catan, { ...catan, minPlaytime: 90, maxPlaytime: 90, rating: 9 }]);
    expect(plan.rows[1].differences).toEqual(['minutes 90', 'rating 9']);
  });

  it('reads an older file with text ranges, comparing it like a current one', () => {
    const old: RawGame = { title: 'Catan', players: '3-4', duration: '60-120', complexity: 'Medium', rating: 7 };
    const plan = planImport([{ ...old, title: 'Azul', players: '2-4' }, catan, old]);

    expect(plan.kept[0]).toMatchObject({ title: 'Azul', minPlayers: 2, maxPlayers: 4, minPlaytime: 60, maxPlaytime: 120 });
    expect(plan.kept[0]).not.toHaveProperty('players');
    expect(plan.rows[2]).toMatchObject({ duplicateOf: 'Catan', differences: [] });
  });

  it('reports a missing rating on the skipped row as "no rating"', () => {
    const plan = planImport([catan, { ...catan, rating: undefined }]);
    expect(plan.rows[1].differences).toEqual(['no rating']);
  });

  it('treats an identical skipped row as having no differences', () => {
    const plan = planImport([azul, { ...azul }]);
    expect(plan.rows[1].differences).toEqual([]);
  });

  it('preserves file order among kept games', () => {
    const plan = planImport([azul, catan, { ...azul, title: 'AZUL' }, { title: 'Wingspan', minPlayers: 1, maxPlayers: 5, minPlaytime: 40, maxPlaytime: 70, complexity: 'Medium' }]);
    expect(plan.kept.map(g => g.title)).toEqual(['Azul', 'Catan', 'Wingspan']);
  });

  it('copes with rows that have no title', () => {
    const plan = planImport([{ ...catan, title: undefined as unknown as string }, { ...azul, title: '' }]);
    expect(plan.kept.length).toBe(1);
    expect(plan.skipped).toBe(1);
  });
});

describe('planPlayerImport', () => {
  it('keeps the first of each name, ignoring case and whitespace', () => {
    const plan = planPlayerImport([{ name: 'Sam' }, { name: 'Alex' }, { name: ' sam ' }, { name: 'ALEX' }]);

    expect(plan.kept.map(p => p.name)).toEqual(['Sam', 'Alex']);
    expect(plan.skipped).toBe(2);
    expect(plan.rows[2]).toEqual({ player: { name: ' sam ' }, duplicateOf: 'Sam' });
    expect(plan.rows[0].duplicateOf).toBeUndefined();
  });

  it('handles an empty list', () => {
    expect(planPlayerImport([])).toEqual({ rows: [], kept: [], skipped: 0 });
  });
});
