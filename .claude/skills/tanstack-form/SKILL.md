---
name: tanstack-form
description: Headless, performant, and type-safe form state management for React. Use before any form work in the renderer (drafts, field validation, submit state).
---

## Overview

TanStack Form manages form state: values, per-field validation, submit lifecycle, and derived flags like `canSubmit` and `isSubmitting`. It is headless, so the design system's own controls render the fields, and it is type-safe end to end from `defaultValues` to `onSubmit`.

**Package:** `@tanstack/react-form`
**Current version:** v1

## Installation

```bash
pnpm add @tanstack/react-form --save-exact
```

## Core anatomy

One `useForm` per draft. Fields render through `form.Field`, submit state renders through `form.Subscribe`, and the native `<form>` wires `handleSubmit`.

```tsx
import { useForm } from '@tanstack/react-form';

function Draft() {
  const form = useForm({
    defaultValues: { name: '' },
    onSubmit: ({ value }) => {
      store(value);
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <input
            value={field.state.value}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.value)}
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
        {([canSubmit, isSubmitting]) => (
          <button disabled={!canSubmit || isSubmitting} type="submit">
            Save
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

## Validation

Validators live on the field, keyed by when they run. A validator answers `undefined` for a value that stands, or the refusal sentence.

```tsx
<form.Field
  name="name"
  validators={{
    onChange: ({ value }) => (value.trim() === '' ? 'A gateway needs a name.' : undefined),
  }}
>
  {(field) => (
    <>
      <input value={field.state.value} onChange={(e) => field.handleChange(e.target.value)} />
      {field.state.meta.isValid ? null : <p role="alert">{field.state.meta.errors.join(' ')}</p>}
    </>
  )}
</form.Field>
```

Standard Schema validators (zod schemas from `@recompose/contracts`) drop in directly:

```tsx
validators={{ onChange: pastedKeySchema }}
```

## Server refusals

A refusal the main process answers after submit belongs to the field it refuses. Map it through an `onSubmitAsync` form validator that returns `{ fields: { name: 'That name is held.' } }`, or keep the mutation's own refusal line outside the form when the refusal concerns the whole draft.

## Subscribing without re-rendering the world

`form.Subscribe` re-renders only its children when the selected slice changes. `useStore(form.store, selector)` does the same for values a sibling needs (a live preview, a shape warning).

```tsx
const port = useStore(form.store, (state) => state.values.port);
```

## House conventions

- One `useForm` per sheet draft; the form never outlives its surface, so a dismissal forgets the draft.
- Fields render the design system's own rows (`FieldBoxRow`); TanStack Form stays invisible to the reading.
- Submit acts read `canSubmit` and the mutation's own pending flag; a mutation refusal that concerns one field lands under that field, and a draft-wide refusal keeps its `role="alert"` line.
- Behavior specs stay on roles and accessible names; nothing asserts on form internals.

## Common pitfalls

- `form.handleSubmit()` returns a promise; `void` it in the DOM handler after `preventDefault`.
- `canSubmit` stands `true` on a pristine form; a draft that must not submit empty needs an `onChange`/`onMount` validator or a value-driven disabled flag.
- Do not read `form.state` during render for reactive values; subscribe through `form.Subscribe` or `useStore`.
- Keep `defaultValues` referentially stable; inline object literals re-created per render reset nothing but cost reconciliation.
