import { z } from 'zod';

export const nonBlankString = z
  .string()
  .refine((value) => value.trim().length > 0, 'must not be blank');
