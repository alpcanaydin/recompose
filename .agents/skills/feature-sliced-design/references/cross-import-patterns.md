# Cross-Import Resolution Patterns

How to resolve cross-imports between slices on the same layer. Cross-imports
are a code smell, not an absolute prohibition. The strategies below are
ordered, but the right choice depends on the project context.

## What is a cross-import?

A cross-import is an import between different slices within the same layer.
For example:

- importing `features/product` from `features/cart`
- importing `widgets/sidebar` from `widgets/header`

The `shared` and `app` layers do not have slices, so imports within those
layers are not cross-imports.

## Why is this a code smell?

Cross-imports blur domain boundaries and introduce implicit dependencies.
Four concrete problems:

1. **Unclear ownership and responsibility.** When `cart` imports from
   `product`, it becomes unclear which slice owns the shared logic.
   Changes to `product`'s internal implementation can break `cart`
   without warning. This makes bugs harder to localize and code harder
   to reason about.
2. **Reduced isolation and testability.** A core benefit of sliced
   architecture is that each slice can be developed, tested, and deployed
   independently. Cross-imports break this isolation. Testing `cart` now
   requires setting up `product`, and changes in one slice can cause
   unexpected test failures in another.
3. **Increased cognitive load.** Working on `cart` now requires accounting
   for how `product` is structured. As cross-imports accumulate, tracing
   the impact of a change requires following more code across slice
   boundaries.
4. **Path to circular dependencies.** Cross-imports often start as one-way
   dependencies but evolve into bidirectional ones (A imports B, B imports
   A). This locks slices together and makes refactoring increasingly costly.

## Entities layer: prefer boundary merge over @x

Cross-imports in `entities` are usually caused by splitting entities too
granularly. Before reaching for `@x`, consider whether the boundaries should
be merged instead.

The `@x` notation is available as a dedicated cross-import surface for
`entities`, but it should be treated as a **last resort**, a **necessary
compromise**, not a recommended approach. Think of `@x` as an explicit
gateway for unavoidable domain references, not a general-purpose reuse
mechanism. Overuse locks entity boundaries together and makes refactoring
more costly over time.

### How @x works (when boundary merge is genuinely impossible)

Each entity exposes a special `@x/` directory containing files named after
the consuming entity. This makes the cross-import explicit and auditable.

**Direction rule:** in the path `entities/A/@x/B`, **A is the producer and
B is the consumer**. Read it as "A crossed with B": the file `A/@x/B.ts`
is the public API that A exposes specifically for B. So in the example
below, `entities/user/@x/order.ts` is what `user` exposes to `order`, and
`order` imports from it.

```text
entities/
  user/
    @x/
      order.ts          ← Exposed specifically for the order entity
    model/
      user.ts
    index.ts
  order/
    model/
      order-summary.ts  ← Imports from user/@x/order
    index.ts
```

```typescript
// entities/user/@x/order.ts: exposes only what order needs
export { getUserDisplayName } from "../model/user";

// entities/order/model/order-summary.ts
import { getUserDisplayName } from "@/entities/user/@x/order";
```

### Rules when using @x

1. Document why `@x` is needed and why merging boundaries does not apply.
2. Review periodically. Requirements change and `@x` may become unnecessary.
3. Minimize the surface area of `@x` exports.
4. Only between entities. Features and widgets should use Strategy C or D
   below, not `@x`.

## Features and widgets: four strategies

In `features` and `widgets`, multiple strategies are available depending on
project context. Cross-imports here are not always forbidden; they are
dependencies that should be deliberate. The four strategies below are
listed in preferred order, but each fits different situations.

### Strategy A: Slice merge

If two slices are not truly independent and always change together, merge
them into a single larger slice.

```text
// Before: two features that always change together
features/profile/
features/profile-settings/

// After: one cohesive feature
features/profile/
  ui/
    Profile.tsx
    ProfileSettings.tsx
  model/
    profile.ts
    profile-settings.ts
  index.ts
```

If two slices keep cross-importing each other and effectively move as one
unit, they are likely one feature in practice. Merging is often the simpler
and cleaner choice.

### Strategy B: Push shared domain flows down into entities

If multiple features share a domain-level flow, move that flow into a domain
slice inside `entities`. Key principles:

- `entities` contains domain types and domain logic only.
- UI remains in `features` and `widgets`.
- Features import and use the domain logic from `entities`.

For example, if both `features/auth` and `features/profile` need session
validation, place session-related domain functions in `entities/session`
and reuse them from both features.

```text
entities/
  session/
    model/
      validate-session.ts
      session.ts
    index.ts

features/
  auth/
    ui/LoginForm.tsx
    model/login.ts        ← imports validateSession from entities/session
    index.ts
  profile/
    ui/ProfilePanel.tsx
    model/profile.ts      ← imports validateSession from entities/session
    index.ts
```

### Strategy C: Compose from an upper layer (IoC)

Instead of connecting slices within the same layer via cross-imports,
compose them at a higher level (`pages` or `app`). The upper layer assembles
and connects the slices; the slices themselves do not know about each other.

Common Inversion of Control techniques:

- **Render props (React)**: pass components or render functions as props.
- **Slots (Vue)**: use named slots to inject content from parent components.
- **Dependency injection**: pass dependencies through props or context.

#### Basic composition (React)

```typescript
// features/user-profile/index.ts
export { UserProfilePanel } from "./ui/UserProfilePanel";

// features/activity-feed/index.ts
export { ActivityFeed } from "./ui/ActivityFeed";

// pages/UserDashboardPage.tsx
import { UserProfilePanel } from "@/features/user-profile";
import { ActivityFeed } from "@/features/activity-feed";

export const UserDashboardPage = () => (
  <div>
    <UserProfilePanel />
    <ActivityFeed />
  </div>
);
```

`features/user-profile` and `features/activity-feed` do not know about each
other. The page composes them.

#### Render props (React)

When one feature needs to render content from another, use render props to
invert the dependency:

```typescript
// features/comment-list/ui/CommentList.tsx
interface CommentListProps {
  comments: Comment[];
  renderUserAvatar?: (userId: string) => React.ReactNode;
}

export const CommentList = ({ comments, renderUserAvatar }: CommentListProps) => (
  <ul>
    {comments.map((comment) => (
      <li key={comment.id}>
        {renderUserAvatar?.(comment.userId)}
        <span>{comment.text}</span>
      </li>
    ))}
  </ul>
);

// pages/PostPage.tsx
import { CommentList } from "@/features/comment-list";
import { UserAvatar } from "@/features/user-profile";

export const PostPage = () => (
  <CommentList
    comments={comments}
    renderUserAvatar={(userId) => <UserAvatar userId={userId} />}
  />
);
```

`CommentList` does not import from `user-profile`. The page injects the
avatar component.

#### Slots (Vue)

Vue's slot system provides a natural way to compose features without
cross-imports:

```vue
<!-- features/comment-list/ui/CommentList.vue -->
<template>
  <ul>
    <li v-for="comment in comments" :key="comment.id">
      <slot name="avatar" :userId="comment.userId" />
      <span>{{ comment.text }}</span>
    </li>
  </ul>
</template>

<!-- pages/PostPage.vue -->
<template>
  <CommentList :comments="comments">
    <template #avatar="{ userId }">
      <UserAvatar :userId="userId" />
    </template>
  </CommentList>
</template>
```

### Strategy D: Cross-feature reuse only via Public API

If strategies A-C do not fit and cross-feature reuse is genuinely
unavoidable, allow it only through an explicit Public API (exported hooks
or UI components). Do not access another slice's `store`, `model`, or
internal implementation.

Unlike strategies A-C which aim to eliminate cross-imports, this strategy
accepts them while minimizing risk through strict boundaries.

```typescript
// features/auth/index.ts
export { useAuth } from "./model/use-auth";
export { AuthButton } from "./ui/AuthButton";

// features/profile/ui/ProfileMenu.tsx
import { useAuth, AuthButton } from "@/features/auth";

export const ProfileMenu = () => {
  const { user } = useAuth();
  if (!user) return <AuthButton />;
  return <div>{user.name}</div>;
};
```

The boundary holds: `features/profile` cannot import from
`@/features/auth/model/internal/*`. Only what `features/auth` explicitly
exposes through `index.ts` is reachable.

The `@x` notation is for the entities layer only. Features and widgets use
strategies A through D above; their access path is the standard public API
(`index.ts`), not a dedicated cross-import surface.

## When to treat a cross-import as a problem

After reviewing these strategies, the question is: when is a cross-import
acceptable to keep, and when should it be treated as a code smell and
refactored?

Common warning signs:

- Directly depending on another slice's `store`, `model`, or business logic
- Deep imports into another slice's internal files (bypassing the public API)
- Bidirectional dependencies (A imports B, and B imports A)
- Changes in one slice frequently breaking another slice
- Flows that should be composed in `pages` or `app`, but are forced into
  cross-imports within the same layer

When these signals appear, treat the cross-import as a code smell and apply
one of the strategies above.

## Strictness depends on project context

The strictness of cross-import enforcement depends on the project:

- In **early-stage products** with heavy experimentation, allowing some
  cross-imports may be a pragmatic speed trade-off.
- In **long-lived or regulated systems** (fintech, large-scale services),
  stricter boundaries pay off in maintainability and stability.

Cross-imports are not an absolute prohibition. They are dependencies that
are generally best avoided, but sometimes used intentionally. If a
cross-import is introduced:

- Treat it as a deliberate architectural choice.
- Document the reasoning in code (a comment explaining why other
  strategies do not apply).
- Revisit it periodically as the system evolves; if requirements change,
  the cross-import may no longer be needed.

## Decision flow for AI agents

```text
Two slices on the same layer need to share code.
  │
  ├─ ENTITIES layer?
  │   ├─ Can boundaries be merged into one entity?
  │   │   └─ YES → Merge. Stop.
  │   └─ Boundaries must stay separate?
  │       └─ Use @x as last resort. Document why merge is not possible.
  │
  └─ FEATURES or WIDGETS layer?
      ├─ Strategy A: Do they always change together?
      │   └─ YES → Merge slices.
      │
      ├─ Strategy B: Is the shared part domain-only logic?
      │   └─ YES → Push down to entities. Keep UI in features.
      │
      ├─ Strategy C: Can the connection be assembled by a higher layer?
      │   └─ YES → Compose in pages or app via render props, slots, or DI.
      │
      └─ Strategy D: Is reuse genuinely unavoidable and the access surface
                     limited to a Public API?
          └─ YES → Allow, but only through index.ts. Never reach into
                   model/, store/, or internal files. Do not use @x in
                   features or widgets.
```

## Anti-patterns

- **Reaching for `@x` in features or widgets.** `@x` is for entities only.
  Use Strategy C (compose) or D (Public API) instead.
- **Treating `@x` as a clean solution.** It is a compromise. If you find
  yourself adding multiple `@x` files between the same entities, the
  boundaries are probably wrong. Merge them.
- **Bypassing the Public API to access internals.** Even when Strategy D is
  in use, importing from `@/features/auth/model/internal/*` defeats the
  purpose. Restrict yourself to what `index.ts` exports.
- **Bidirectional cross-imports.** A imports B and B imports A is almost
  always a sign that the slices should be merged.

## See also

- `references/excessive-entities.md`: prevent the conditions that lead to
  entity-layer cross-imports in the first place.
- `references/layer-structure.md`: layer rules and import directions.
