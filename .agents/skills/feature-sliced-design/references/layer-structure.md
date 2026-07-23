# Layer Structure Reference

Detailed folder structures, code examples, and naming conventions for each
FSD layer. Use this reference when creating, reviewing, or reorganizing
project structure.

---

## App Layer

App-wide initialization: providers, routing, global styles, entry point.
Organized by segments only, no slices.

The methodology does not formally standardize App segment names. The
common convention list (`ui`, `api`, `model`, `lib`, `config`) applies to
all layers but is rarely a good fit here. In practice, projects use names
that describe purpose: `routes`, `store`, `styles`, `providers`,
`entrypoint`, etc. Choose names that match your stack (for example,
`providers` for React/Vue provider components that wrap Redux,
QueryClient, or theme contexts):

```text
app/
  routes/          ← Route configuration (or router.tsx for single file)
  store/           ← Global state store (Redux configureStore, Zustand root)
  styles/          ← Global CSS, reset, theme variables
  providers/       ← Provider components (Redux Provider, QueryClientProvider)
  entrypoint.tsx   ← Application entry point (main.tsx, index.tsx)
```

A smaller project may collapse some of these into single files:

```text
app/
  router.tsx       ← Route configuration
  store.ts         ← Store configuration
  styles/
    global.css
  providers.tsx    ← All providers in one file
  index.tsx        ← Entry point
```

```typescript
// app/router.tsx
import { HomePage } from '@/pages/home';
import { ProfilePage } from '@/pages/profile';

export const router = createBrowserRouter([
  { path: '/', element: <HomePage /> },
  { path: '/profile/:id', element: <ProfilePage /> },
]);
```

**Belongs in app:** Global providers (Redux store, QueryClient, theme),
routing setup, global styles, error boundaries, analytics initialization.

**Does not belong:** Feature-specific code, business logic, page-level UI.

---

## Pages Layer

Route-level composition. In v2.1, pages **own substantial logic**: they are
not thin wrappers. In early project stages, most code lives here.

```text
pages/
  home/
    ui/
      HomePage.tsx
      HeroSection.tsx
      FeaturesGrid.tsx
    model/
      home-data.ts          ← Page-specific state + logic
    api/
      fetch-home-data.ts    ← Page-specific API calls
    index.ts
  profile/
    ui/
      ProfilePage.tsx
      ProfileForm.tsx
      ProfileStats.tsx
    model/
      profile.ts            ← Profile state + validation logic
    api/
      update-profile.ts
      fetch-profile.ts
    index.ts
```

**Belongs in pages:** Page-specific UI, forms, validation, data fetching,
state management, business logic, API integrations. Even code that looks
reusable stays here if it is simpler to keep local.

**Does not belong:** Code that is currently being reused across multiple
pages with stable boundaries (extract to a lower layer when reuse is
confirmed, not anticipated).

### Page Layout Patterns

A typical page composes widgets, features, and entities from lower layers,
plus its own local UI components:

```typescript
// pages/product-detail/ui/ProductDetailPage.tsx
import { Header } from '@/widgets/header';
import { AddToCart } from '@/features/add-to-cart';
import { Product } from '@/entities/product';

export const ProductDetailPage = ({ productId }) => {
  const product = useProductDetail(productId); // local hook in this page

  return (
    <>
      <Header />
      <Product.Card data={product} />
      <AddToCart productId={productId} />
      <RelatedProducts products={product.related} /> {/* local component */}
    </>
  );
};
```

For pages that only need shared + page-local code (no extracted layers):

```typescript
// pages/about/ui/AboutPage.tsx
import { Card } from '@/shared/ui/Card';
import { TeamSection } from './TeamSection';  // local to this page
import { MissionStatement } from './MissionStatement';

export const AboutPage = () => (
  <main>
    <MissionStatement />
    <Card><TeamSection /></Card>
  </main>
);
```

---

## Widgets Layer

Composite UI blocks with their own logic, **reused across multiple pages**.
Add this layer only when UI blocks actually appear in 2+ pages and sharing
provides clear value.

```text
widgets/
  header/
    ui/
      Header.tsx
      Navigation.tsx
      UserMenu.tsx
    model/
      header.ts              ← Widget state
    api/
      fetch-notifications.ts
    index.ts
  sidebar/
    ui/
      Sidebar.tsx
    model/
      sidebar.ts
    index.ts
```

**Belongs in widgets:** Navigation bars, sidebars, dashboards, footers,
complex card layouts that combine data from multiple entities/features.

**Does not belong:** Simple UI primitives (→ `shared/ui/`), single-use
page sections (→ keep in the page).

---

## Features Layer

Independent, reusable user interactions. **Create only when used in 2+ places.**

```text
features/
  auth/
    ui/
      LoginForm.tsx
      RegisterForm.tsx
    model/
      auth.ts               ← Auth state + logic
    api/
      login.ts
      register.ts
    index.ts
  add-to-cart/
    ui/
      AddToCartButton.tsx
    model/
      cart.ts
    index.ts
  like-post/
    ui/
      LikeButton.tsx
    model/
      like.ts
    api/
      toggle-like.ts
    index.ts
```

**Feature composition**: features consume entities and are composed in
higher layers:

```typescript
// widgets/post-card/ui/PostCard.tsx
import { UserAvatar } from '@/entities/user';
import { LikeButton } from '@/features/like-post';
import { CommentButton } from '@/features/comment-create';

export const PostCard = ({ post }) => (
  <article>
    <UserAvatar userId={post.authorId} />
    <h2>{post.title}</h2>
    <p>{post.content}</p>
    <div>
      <LikeButton postId={post.id} />
      <CommentButton postId={post.id} />
    </div>
  </article>
);
```

---

## Entities Layer

Reusable business domain models. **Create only when used in 2+ places. Starting
without this layer is completely valid.**

```text
// Minimal entity: model only (most common form)
entities/user/
  model/
    user.ts                  ← Types + domain logic
  index.ts

// Entity with UI (use with caution)
// ⚠️ Adding UI to entities increases cross-import risk.
// Other entities may want to import this UI, leading to @x dependencies.
// Entity UI should only be imported from higher layers (features, widgets,
// pages), never from other entities.
entities/product/
  model/
    product.ts
  ui/
    ProductCard.tsx
  index.ts
```

---

## Shared Layer Structure

Infrastructure with no business logic. Organized by segments only (no slices).
Segments may import from each other.

```text
shared/
  ui/                ← UI kit: Button, Input, Modal, Card
  lib/               ← Utilities: formatDate, debounce, classnames
  api/               ← API client, route constants, CRUD helpers, base types
  auth/              ← Auth tokens, login utilities, session management
  config/            ← Environment variables, app settings
  assets/            ← Branding assets shared across the app (use sparingly)
```

```typescript
// shared/ui/Button/Button.tsx
export const Button = ({ children, onClick, variant = 'primary' }) => (
  <button className={`btn btn-${variant}`} onClick={onClick}>
    {children}
  </button>
);

// shared/ui/Button/index.ts
export { Button } from './Button';
export type { ButtonProps } from './Button';
```

Shared **may** contain application-aware code (route constants, API endpoints,
branding assets, common types). It must **never** contain business logic,
feature-specific code, or entity-specific code.

For asset placement specifically (images, icons, fonts, PDFs), see
`references/asset-handling.md`.

---

## Segments

A segment groups related code within a slice (or within App/Shared). The
standard segments cover the most common technical purposes:

- **`ui`**: UI display (components, date formatters, styles).
- **`api`**: backend interactions (request functions, data types, mappers).
- **`model`**: data model (schemas, interfaces, stores, business logic).
- **`lib`**: library code that other modules in this slice need.
- **`config`**: configuration files and feature flags.

Custom segments are allowed when needed (for example, `routes` and `i18n`
in the Shared layer, or `auth` for token storage when split out from
`shared/api`).

### Group by what it is *for*, not by what it *is*

Segment names describe **purpose**, not the kind of code they hold. This
is the desegmentation principle:

```text
// ❌ BAD: grouping by technical kind (what the code is)
shared/
  components/         ← What kind of components?
  hooks/              ← Which feature do they serve?
  types/              ← Which domain do they describe?
  utils/              ← Utility for what?
  helpers/            ← Same problem
  actions/            ← Redux actions for what?

// ✅ GOOD: grouping by purpose (what the code is for)
shared/
  ui/                 ← For displaying UI
  api/                ← For talking to the backend
  lib/                ← For library code that supports the slice
  config/             ← For configuration
```

A segment named `types/` cannot answer "types for what?" without inspecting
the contents. A segment named `model/` says: this is the data model.
Inside `model/`, files are named by domain (`user.ts`, `order.ts`), not by
technical role.

This rule applies everywhere: in `shared/`, in slices, and when designing
new custom segments.

## Naming Conventions

### Domain-based file naming

Within a segment, name files after the business domain, not the technical
role:

```text
// ❌ Technical-role naming: mixes domains
model/types.ts          ← Which types? User? Order?
model/utils.ts
api/endpoints.ts
model/selectors.ts

// ✅ Domain-based naming: each file owns one domain
model/user.ts           ← User types + logic + store
model/order.ts          ← Order types + logic + store
api/fetch-profile.ts    ← Clear what this API does
model/todo.ts           ← Redux slice + selectors + thunks
```

### Single-concern segments

If a segment contains only one domain concern, the filename may match the
slice name:

```text
features/auth/
  model/
    auth.ts          ← Single concern, matches slice name
```

### Index files as public API

Every slice must have an `index.ts` that re-exports its public interface:

```typescript
// entities/user/index.ts
export { UserAvatar } from "./ui/UserAvatar";
export { useUser, type User } from "./model/user";
```

---

## Slice Groups

A **slice group** is a folder that contains related slices on the same
layer, used purely to make the structure easier to navigate as the number
of slices grows. A slice group is **not** a slice itself: it has no
segments (`model/`, `ui/`, `api/`), no public API (`index.ts`), and no
shared code. Slice isolation rules apply unchanged inside a group: sibling
slices in the same group cannot import from each other.

Slice groups are optional. Use them only when the layer has grown large
enough that a flat structure becomes hard to scan and there is an obvious
grouping criterion.

### When to use

- Several slices share the same business context and are scattered across
  the layer.
- The slice names clearly suggest they belong to the same topic.
- The layer has grown to the point where it is hard to scan at a glance.

### When NOT to use

- Names alone are enough for quick navigation.
- There is no natural grouping criterion.
- Only two or three slices would end up in the group.

### Example: grouping payment-related entities

```text
entities/
  payment/                  ← Slice group (no public API)
    invoice/                ← Slice
      model/
      ui/
      index.ts
    receipt/                ← Slice (model/, ui/, index.ts)
    transaction/            ← Slice (model/, ui/, index.ts)
  user/                     ← Slice (not in any group)
  product/                  ← Slice
```

Imports go through the full path:

```typescript
import { Invoice } from "@/entities/payment/invoice";
import { Receipt } from "@/entities/payment/receipt";
```

The same pattern applies to the Pages layer. For example, grouping
`pages/order/{list,detail,create}` when there are multiple pages on the same
topic such as list, detail, create, and edit. This is one possible example
and does not represent the default structure for the Pages layer.

### Features: use with caution

Slice groups can be applied to Features, but features often span multiple
entities and lack a natural grouping criterion. A group like
`features/cart/` tends to attract everything cart-related (DTOs, mappers,
helpers) until it stops being a navigation aid and starts acting as the
home for the entire cart domain, which weakens the principle that
features are split by use case. Before grouping features, check that the
group contains only feature slices and that two or three slices is not the
entire content.

### Anti-patterns

- **Do not put `index.ts` on the group folder.** That promotes the group
  to a slice and breaks the layer's contract.
- **Do not put shared `utils.ts`, `constants.ts`, or `types.ts` files
  inside the group.** A slice group has no shared code. Extract reusable
  code to `shared/` instead. If the layer is `entities` and the shared
  logic is genuinely domain logic, consider whether the boundaries are
  too granular and the slices should be merged into one isolated entity
  (see `references/excessive-entities.md`). The `@x` notation does not
  apply to slice groups. It is a cross-import surface between entity
  slices, not a sharing mechanism for siblings within a group.
- **Do not relax slice isolation inside the group.** If two slices in the
  same group need to share code, extract it one layer down rather than
  adding a `_common/` file.

---

## Path Aliases

Configure path aliases so imports follow the `@/layer/slice` pattern:

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/app/*": ["src/app/*"],
      "@/pages/*": ["src/pages/*"],
      "@/widgets/*": ["src/widgets/*"],
      "@/features/*": ["src/features/*"],
      "@/entities/*": ["src/entities/*"],
      "@/shared/*": ["src/shared/*"]
    }
  }
}
```

For framework-specific alias configuration (Vite, Next.js, Nuxt, Astro),
see `references/framework-integration.md`.
