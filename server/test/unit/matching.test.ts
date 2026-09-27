import { describe, expect, it } from 'vitest';
import { nameMatches, nameParts, textContains, textMentions } from '../../src/evaluation/rules/matching.ts';

describe('name matching', () => {
  it('splits class names into words', () => {
    expect(nameParts('EVChargingSpot')).toEqual(['ev', 'charging', 'spot']);
    expect(nameParts('parking_lot')).toEqual(['parking', 'lot']);
    expect(nameParts('Level2Spot')).toEqual(['level', '2', 'spot']);
  });

  it('matches whole words and multi-word synonyms', () => {
    expect(nameMatches('ParkingSpot', ['spot'])).toBe(true);
    expect(nameMatches('ParkingLot', ['parkinglot'])).toBe(true);
    expect(nameMatches('Spots', ['spot'])).toBe(true);
    expect(nameMatches('Garages', ['garage'])).toBe(true);
  });

  it('does not match part of a word', () => {
    expect(nameMatches('CardPayment', ['car'])).toBe(false);
    expect(nameMatches('Spotlight', ['spot'])).toBe(false);
  });
});

describe('text matching', () => {
  it('finds whole words in prose, allowing plurals', () => {
    expect(textMentions('Each floor has many spots.', ['spot'])).toBe(true);
    expect(textMentions('The card reader beeps.', ['car'])).toBe(false);
  });

  it('finds fragments anywhere', () => {
    expect(textContains('We handle Concurrency with a lock.', ['concurren'])).toBe(true);
    expect(textContains('Nothing about it.', ['lock'])).toBe(false);
  });
});
