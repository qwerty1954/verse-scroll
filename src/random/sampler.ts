// Weighted random draw of verses without repeats. Pure, so it can be unit-tested with a seeded
// random number generator.
//
// The pool is every verse in the filter that hasn't been seen or drawn. Picks are proportional
// to weight, found by binary search in a cumulative-weight array. Rather than rebuild that array
// after every card, drawn verses are skipped on sight, and the array is rebuilt after
// REBUILD_AFTER draws or when too many picks in a row land on skipped verses.
import { verseId, type Testament } from '../esv/books.ts';

export type RandomFilter = 'all' | Testament;

/** WEIGHTS[book][chapter][verse], all 0-based, any positive numbers. */
export type WeightTable = number[][][];

const REBUILD_AFTER = 200;
const MAX_TRIES = 40;
/** Don't show two cards from the same chapter within this many cards. */
export const RECENT_CHAPTERS = 5;

function inFilter(book: number, filter: RandomFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'OT' ? book <= 39 : book >= 40;
}

export class Sampler {
  private ids: number[] = [];
  private cumulative: number[] = [];
  private total = 0;
  private drawsSinceBuild = 0;
  private readonly recent: number[] = [];
  private readonly weights: WeightTable;
  private filter: RandomFilter;
  /** Verses already seen; also receives each verse this sampler draws. */
  private readonly excluded: Set<number>;

  constructor(weights: WeightTable, filter: RandomFilter, excluded: Set<number>) {
    this.weights = weights;
    this.filter = filter;
    this.excluded = excluded;
    this.rebuild();
  }

  setFilter(filter: RandomFilter): void {
    this.filter = filter;
    this.recent.length = 0;
    this.rebuild();
  }

  /** Never draw this verse, e.g. because it was shown as part of another verse's group. */
  exclude(id: number): void {
    this.excluded.add(id);
  }

  /** Verses left to draw under the current filter (as of the last rebuild). */
  get remaining(): number {
    return this.ids.length;
  }

  private rebuild(): void {
    this.ids = [];
    this.cumulative = [];
    this.total = 0;
    this.weights.forEach((chapters, b) => {
      if (!inFilter(b + 1, this.filter)) return;
      chapters.forEach((verses, c) => {
        verses.forEach((weight, v) => {
          const id = verseId(b + 1, c + 1, v + 1);
          if (this.excluded.has(id) || weight <= 0) return;
          this.total += weight;
          this.ids.push(id);
          this.cumulative.push(this.total);
        });
      });
    });
    this.drawsSinceBuild = 0;
  }

  private pick(random: () => number): number {
    const target = random() * this.total;
    let lo = 0;
    let hi = this.cumulative.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.cumulative[mid] > target) hi = mid;
      else lo = mid + 1;
    }
    return this.ids[lo];
  }

  /** The next verse id, or null when every verse in the filter has been seen. */
  draw(random: () => number = Math.random): number | null {
    if (this.drawsSinceBuild >= REBUILD_AFTER) this.rebuild();

    for (let attempt = 0; attempt < 2; attempt++) {
      if (this.ids.length === 0) return null;
      let fallback: number | null = null;
      for (let i = 0; i < MAX_TRIES; i++) {
        const id = this.pick(random);
        if (this.excluded.has(id)) continue;
        fallback ??= id;
        if (this.recent.includes(Math.floor(id / 1000))) continue;
        return this.accept(id);
      }
      // Only recent chapters are left (a nearly finished pool): allow a repeat chapter.
      if (fallback !== null) return this.accept(fallback);
      // Every try hit an already-drawn verse, so the array is stale: rebuild and try once more.
      this.rebuild();
    }
    return null;
  }

  private accept(id: number): number {
    this.excluded.add(id);
    this.drawsSinceBuild++;
    this.recent.push(Math.floor(id / 1000));
    if (this.recent.length > RECENT_CHAPTERS) this.recent.shift();
    return id;
  }
}

/** Small seeded generator for tests and reproducible runs. */
export function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
