import { RawGame } from './game';
import { planImport } from './import-plan';

const catan: RawGame = { title: 'Catan', players: '3-4', duration: '60-120', complexity: 'Medium', rating: 7 };
const azul: RawGame = { title: 'Azul', players: '2-4', duration: '30-45', complexity: 'Easy', rating: 9 };

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
    const plan = planImport([catan, { ...catan, duration: '90', rating: 9 }]);
    expect(plan.rows[1].differences).toEqual(['duration 90', 'rating 9']);
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
    const plan = planImport([azul, catan, { ...azul, title: 'AZUL' }, { title: 'Wingspan', players: '1-5', duration: '40-70', complexity: 'Medium' }]);
    expect(plan.kept.map(g => g.title)).toEqual(['Azul', 'Catan', 'Wingspan']);
  });

  it('copes with rows that have no title', () => {
    const plan = planImport([{ ...catan, title: undefined as unknown as string }, { ...azul, title: '' }]);
    expect(plan.kept.length).toBe(1);
    expect(plan.skipped).toBe(1);
  });
});
