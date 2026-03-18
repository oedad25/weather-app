# Guest Mode — Design Spec

## Goal

Allow unauthenticated users to search weather immediately without registering. The app loads directly into the search view. Auth-only features (favorites, history) are gated behind login.

## Approach

Remove `requireAuth` from weather search and coords routes. Adjust the client to start in app view by default. No database or schema changes.

## Server Changes

### `server/src/routes/weather.ts`

- Remove the top-level `router.use(requireAuth)` line.
- Add `requireAuth` individually to the `GET /history` route only.
- Make `recordSearch` conditional in search and coords handlers: only call it when `req.userId` exists.
- Import `requireAuth` is still needed (for history route).

### `server/src/middleware/auth.ts`

- Add an `optionalAuth` middleware that extracts `req.userId` from the Bearer token if present, but does NOT return 401 if missing. This allows the weather routes to know whether a user is logged in without requiring it.

### `server/src/middleware/rate-limit.ts`

- Update `weatherLimiter` key generator: use `req.userId` if available, fall back to `req.ip` for guests.

## Client Changes

### `client/src/app.ts`

- On startup, attempt `checkAuth()`. If it succeeds, show full app view (favorites, history, logout). If it fails, show app view anyway but in "guest mode" — search bar visible, no favorites/history/logout.
- Track a `isGuest` boolean state variable.

### `client/src/ui.ts`

- Add `showGuestAppView()` function: shows search bar, hides favorites container, history button, logout button, user email span. Shows a "Login" link in the header.
- Add `showLoginPrompt()` function: when guest clicks fav star or history, show a brief message prompting them to log in.

### `client/src/auth.ts`

- `fetchWithAuth` should not retry on 401 for guest users (no token to refresh). If no access token exists, send request without Authorization header.

### `client/index.html`

- Add a "Login" link element in the header (hidden by default, shown for guests).

### `client/styles.css`

- Style for the login link in the header.

## Testing

### Integration tests: modify `server/src/tests/integration/weather.test.ts`

- Add test: `GET /api/weather/search?city=Denver&unit=celsius` without auth token returns 200 (not 401).
- Verify existing test: `GET /api/weather/history` without auth token still returns 401.

### E2E test: extend `e2e/tests/user-journey.spec.ts`

- Add a separate test: visit `/`, verify search bar is visible without logging in, search a city, verify `.current-weather` renders.

## Files Changed

| File | Action |
|------|--------|
| `server/src/routes/weather.ts` | Modify — remove blanket `requireAuth`, add to history only, conditional `recordSearch` |
| `server/src/middleware/auth.ts` | Modify — add `optionalAuth` middleware |
| `server/src/middleware/rate-limit.ts` | Modify — fall back to IP for guest rate limiting |
| `client/src/app.ts` | Modify — guest mode startup flow |
| `client/src/ui.ts` | Modify — add `showGuestAppView()`, `showLoginPrompt()` |
| `client/src/auth.ts` | Modify — handle missing token gracefully |
| `client/index.html` | Modify — add login link element |
| `client/styles.css` | Modify — login link styling |
| `server/src/tests/integration/weather.test.ts` | Modify — add unauthenticated search test |
| `e2e/tests/user-journey.spec.ts` | Modify — add guest mode test |

## Out of Scope

- Guest favorites (localStorage-based)
- Guest search history
- Anonymous JWT tokens
- Guest-to-user migration (converting guest data on registration)
