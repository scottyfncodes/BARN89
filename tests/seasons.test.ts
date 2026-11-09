import { describe, expect, it } from 'vitest';
import { clockNow, seasonAt } from '../src/content/seasons';

const at = (iso: string) => seasonAt(new Date(iso));

describe('the real calendar on the homestead', () => {
  it('lights come on around sundown and go off at first light', () => {
    expect(at('2026-06-20T14:00').dusk).toBe(false);
    expect(at('2026-06-20T20:40').dusk).toBe(true);
    expect(at('2026-12-10T17:30').dusk).toBe(true);
    expect(at('2026-12-10T16:30').dusk).toBe(false);
    expect(at('2026-03-01T02:00').dusk).toBe(true);
    expect(at('2026-03-01T07:00').dusk).toBe(false);
  });

  it('Christmas runs from December 1 to Epiphany', () => {
    expect(at('2026-11-30T12:00').christmas).toBe(false);
    expect(at('2026-12-01T12:00').christmas).toBe(true);
    expect(at('2027-01-06T12:00').christmas).toBe(true);
    expect(at('2027-01-07T12:00').christmas).toBe(false);
  });

  it('puts pumpkins out in October and the flag out in July', () => {
    expect(at('2026-10-15T12:00').touch).toBe('pumpkins');
    expect(at('2026-07-04T12:00').touch).toBe('flag');
    expect(at('2026-05-15T12:00').touch).toBe(null);
  });

  it('says hello to each season once a year, and early January belongs to last Christmas', () => {
    expect(at('2026-12-24T12:00').note?.key).toBe('season-christmas-2026');
    expect(at('2027-01-03T12:00').note?.key).toBe('season-christmas-2026');
    expect(at('2026-10-02T12:00').note?.key).toBe('season-october-2026');
    expect(at('2026-05-02T12:00').note).toBe(null);
  });

  it('can be pointed at another day for trying it out', () => {
    expect(clockNow('?date=2026-12-24T19:30').getMonth()).toBe(11);
    expect(clockNow('?date=nonsense').getFullYear()).toBeGreaterThan(2000);
  });
});
