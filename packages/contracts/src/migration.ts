export type Migration = {
  from: number;
  migrate: (doc: Record<string, unknown>) => Record<string, unknown>;
};

function assertDocumentShape(doc: unknown): asserts doc is Record<string, unknown> {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('document has no schemaVersion');
  }
}

function readSchemaVersion(doc: unknown): number {
  assertDocumentShape(doc);

  if (!('schemaVersion' in doc)) {
    throw new Error('document has no schemaVersion');
  }

  const version = doc['schemaVersion'];

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('schemaVersion must be a positive integer');
  }

  return version;
}

export function migrateDocument(
  doc: unknown,
  migrations: readonly Migration[],
  currentVersion: number,
): unknown {
  let version = readSchemaVersion(doc);

  if (version > currentVersion) {
    throw new Error(`document schemaVersion ${version} is newer than supported ${currentVersion}`);
  }

  assertDocumentShape(doc);

  const migrationsByStartVersion = new Map(
    migrations.map((migration) => [migration.from, migration]),
  );
  let migrated = doc;

  while (version < currentVersion) {
    const step = migrationsByStartVersion.get(version);

    if (step === undefined) {
      throw new Error(`no migration from schemaVersion ${version}`);
    }

    migrated = step.migrate(migrated);
    version = readSchemaVersion(migrated);
  }

  return migrated;
}
