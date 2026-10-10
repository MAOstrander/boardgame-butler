import { pickOne, shuffle, splitTeams } from './table-picks';

/** A random source that returns the given values in turn, then repeats. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('pickOne', () => {
  it('maps the random source across the list', () => {
    const names = ['Sam', 'Alex', 'Jo'];
    expect(pickOne(names, () => 0)).toBe('Sam');
    expect(pickOne(names, () => 0.5)).toBe('Alex');
    expect(pickOne(names, () => 0.999)).toBe('Jo');
  });

  it('returns undefined for an empty list', () => {
    expect(pickOne([], () => 0)).toBeUndefined();
  });
});

describe('shuffle', () => {
  it('keeps every item exactly once and leaves the input alone', () => {
    const names = ['Sam', 'Alex', 'Jo', 'Riley', 'Morgan'];
    const out = shuffle(names);
    expect([...out].sort()).toEqual([...names].sort());
    expect(names).toEqual(['Sam', 'Alex', 'Jo', 'Riley', 'Morgan']);
  });

  it('swaps from the end using the random source', () => {
    // i=2: j=floor(0*3)=0 → [c,b,a]; i=1: j=floor(0*2)=0 → [b,c,a]
    expect(shuffle(['a', 'b', 'c'], () => 0)).toEqual(['b', 'c', 'a']);
    // A source near 1 always picks j=i, leaving the order unchanged.
    expect(shuffle(['a', 'b', 'c'], () => 0.999)).toEqual(['a', 'b', 'c']);
  });

  it('copes with empty and single lists', () => {
    expect(shuffle([])).toEqual([]);
    expect(shuffle(['a'])).toEqual(['a']);
  });
});

describe('splitTeams', () => {
  it('deals round-robin so sizes differ by at most one', () => {
    const teams = splitTeams(['a', 'b', 'c', 'd', 'e'], 2, () => 0.999);
    expect(teams).toEqual([['a', 'c', 'e'], ['b', 'd']]);
  });

  it('puts everyone on exactly one team', () => {
    const names = ['Sam', 'Alex', 'Jo', 'Riley', 'Morgan', 'Pat', 'Kim'];
    const teams = splitTeams(names, 3, sequence(0.1, 0.7, 0.4, 0.9));
    expect(teams.map(t => t.length).sort()).toEqual([2, 2, 3]);
    expect(teams.flat().sort()).toEqual([...names].sort());
  });

  it('never returns an empty team', () => {
    expect(splitTeams(['a', 'b'], 5, () => 0.999)).toEqual([['a'], ['b']]);
    expect(splitTeams(['a', 'b'], 0, () => 0.999)).toEqual([['a', 'b']]);
    expect(splitTeams([], 2)).toEqual([]);
  });
});
