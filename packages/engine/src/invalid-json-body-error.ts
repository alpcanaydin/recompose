export class InvalidJsonBodyError extends Error {
  readonly status = 400;
  readonly scope = 'request';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidJsonBodyError';
  }
}
