import { fc, test } from '@fast-check/vitest';
import { describe, expect } from 'vitest';

import { migrateDocument, type Migration } from './migration';

const renameTitleToName: Migration = {
  from: 1,
  migrate: (doc) => {
    const { title, ...rest } = doc;

    return { ...rest, name: title, schemaVersion: 2 };
  },
};

function hasNumericSchemaVersion(value: unknown): value is { schemaVersion: number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    typeof value.schemaVersion === 'number'
  );
}

const addCreatedFlag: Migration = {
  from: 2,
  migrate: (doc) => ({ ...doc, created: true, schemaVersion: 3 }),
};

const stallAtVersionOne: Migration = {
  from: 1,
  migrate: (doc) => ({ ...doc, schemaVersion: 1 }),
};

const rewindToVersionOne: Migration = {
  from: 2,
  migrate: (doc) => ({ ...doc, schemaVersion: 1 }),
};

function stepProducing(from: number, producedVersion: number): Migration {
  return { from, migrate: (doc) => ({ ...doc, schemaVersion: producedVersion }) };
}

describe('document migration', () => {
  test('a current-version document passes through untouched', () => {
    const doc = { schemaVersion: 3, name: 'x', created: true };

    const result = migrateDocument(doc, [renameTitleToName, addCreatedFlag], 3);

    expect(result).toEqual(doc);
  });

  test('an old document is migrated stepwise to the current version', () => {
    const result = migrateDocument(
      { schemaVersion: 1, title: 'legacy' },
      [renameTitleToName, addCreatedFlag],
      3,
    );

    expect(result).toEqual({ schemaVersion: 3, name: 'legacy', created: true });
  });

  test('a document without an integer schemaVersion is rejected', () => {
    expect(() => migrateDocument({ name: 'x' }, [], 1)).toThrow(/schemaVersion/);
    expect(() => migrateDocument({ schemaVersion: 'one' }, [], 1)).toThrow(/schemaVersion/);
    expect(() => migrateDocument(null, [], 1)).toThrow(/schemaVersion/);
  });

  test('a document newer than the current version is rejected', () => {
    expect(() =>
      migrateDocument({ schemaVersion: 4 }, [renameTitleToName, addCreatedFlag], 3),
    ).toThrow(/newer/);
  });

  test('a version gap with no covering migration is rejected', () => {
    expect(() => migrateDocument({ schemaVersion: 1 }, [addCreatedFlag], 3)).toThrow(/migration/);
  });

  const anyStartVersion = fc.integer({ min: 1, max: 3 });

  test.prop([anyStartVersion])(
    'every historical version reaches the current version through the chain',
    (startVersion) => {
      const doc = { schemaVersion: startVersion, title: 'seed', name: 'seed', created: false };

      const result = migrateDocument(doc, [renameTitleToName, addCreatedFlag], 3);

      if (!hasNumericSchemaVersion(result)) {
        throw new Error('expected result to have a numeric schemaVersion');
      }

      expect(result.schemaVersion).toBe(3);
    },
  );
});

describe('migration step progress', () => {
  test('a step that leaves the version where it found it is refused', () => {
    expect(() =>
      migrateDocument({ schemaVersion: 1, title: 'stuck' }, [stallAtVersionOne], 3),
    ).toThrow(
      'migration from schemaVersion 1 did not advance the document, which came back at schemaVersion 1',
    );
  });

  test('a step that lowers the version is refused', () => {
    expect(() => migrateDocument({ schemaVersion: 2 }, [rewindToVersionOne], 3)).toThrow(
      'migration from schemaVersion 2 did not advance the document, which came back at schemaVersion 1',
    );
  });

  const anyVersion = fc.integer({ min: 1, max: 6 });

  test.prop([anyVersion, anyVersion])(
    'a step carries the chain forward only when it raises the version without passing the target',
    (fromVersion, producedVersion) => {
      const target = fromVersion + 1;
      const migrate = () =>
        migrateDocument(
          { schemaVersion: fromVersion },
          [stepProducing(fromVersion, producedVersion)],
          target,
        );

      if (producedVersion <= fromVersion) {
        expect(migrate).toThrow(/did not advance the document/);

        return;
      }

      if (producedVersion > target) {
        expect(migrate).toThrow(/overshot the supported schemaVersion/);

        return;
      }

      expect(migrate()).toEqual({ schemaVersion: producedVersion });
    },
  );

  test('a step that jumps past the supported version is refused', () => {
    expect(() => migrateDocument({ schemaVersion: 1 }, [stepProducing(1, 5)], 2)).toThrow(
      'migration from schemaVersion 1 overshot the supported schemaVersion 2, landing at 5',
    );
  });
});
