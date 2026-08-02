import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ITEM_NOT_FOUND = 44;
const UNKNOWN_REQUEST = 2;

type Request = {
  operation: string;
  service: string;
  account: string;
  secret: string | null;
  asksForTheSecret: boolean;
};

function valueAfter(argv: readonly string[], flag: string): string | null {
  const at = argv.indexOf(flag);

  return at === -1 ? null : (argv[at + 1] ?? null);
}

function readRequest(argv: readonly string[]): Request {
  return {
    operation: argv[0] ?? '',
    service: valueAfter(argv, '-s') ?? '',
    account: valueAfter(argv, '-a') ?? '',
    secret: valueAfter(argv, '-w'),
    asksForTheSecret: argv.includes('-w'),
  };
}

function shelf(store: string, request: Request): string {
  const name = Buffer.from(`${request.service}\n${request.account}`).toString('base64url');

  return join(store, name);
}

async function heldBlob(store: string, request: Request): Promise<string | null> {
  return readFile(shelf(store, request), 'utf8').then(
    (blob) => blob,
    () => null,
  );
}

async function findGenericPassword(store: string, request: Request): Promise<number> {
  const held = await heldBlob(store, request);

  if (held === null) {
    return ITEM_NOT_FOUND;
  }

  if (request.asksForTheSecret) {
    process.stdout.write(`${held}\n`);
  }

  return 0;
}

async function addGenericPassword(store: string, request: Request): Promise<number> {
  await mkdir(store, { recursive: true });
  await writeFile(shelf(store, request), request.secret ?? '', 'utf8');

  return 0;
}

async function deleteGenericPassword(store: string, request: Request): Promise<number> {
  if ((await heldBlob(store, request)) === null) {
    return ITEM_NOT_FOUND;
  }

  await rm(shelf(store, request), { force: true });

  return 0;
}

async function answer(store: string, request: Request): Promise<number> {
  if (request.operation === 'find-generic-password') {
    return findGenericPassword(store, request);
  }

  if (request.operation === 'add-generic-password') {
    return addGenericPassword(store, request);
  }

  if (request.operation === 'delete-generic-password') {
    return deleteGenericPassword(store, request);
  }

  process.stderr.write(`the fake security does not answer ${request.operation}\n`);

  return UNKNOWN_REQUEST;
}

const store = process.env['RECOMPOSE_FAKE_KEYCHAIN_DIR'];

if (store === undefined || store === '') {
  process.stderr.write('the fake security needs RECOMPOSE_FAKE_KEYCHAIN_DIR\n');
  process.exit(UNKNOWN_REQUEST);
}

process.exit(await answer(store, readRequest(process.argv.slice(2))));
