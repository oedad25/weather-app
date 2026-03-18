# Guest Mode — Design Spec

## Goal

Allow unauthenticated users to search weather immediately without registering. The app loads directly into the search view. Auth-only features (favorites, history) are gated behind login.

## Approach

Remove `requireAuth` from weather search and coords routes. Add `optionalAuth` so routes can detect logged-in users without requiring it. Adjust the client to start in guest app view by default. No database or schema changes.

## Server Changes

### `server/src/routes/weather.ts`

- Remove the top-level `router.use(requireAuth)` line.
- Add `optionalAuth` middleware to the router level (applies to all weather routes): `router.use(optionalAuth)`.
- Add `requireAuth` individually to the `GET /history` route only.
- Make `recordSearch` conditional in search and coords handlers: only call it when `req.userId` exists (wrap in `if (req.userId) { ... }`).
- Import both `requireAuth` and `optionalAuth` from `../middleware/auth.js`.

### `server/src/middleware/auth.ts`

- Add an `optionalAuth` middleware that:
  - If no Authorization header or no Bearer prefix: calls `next()` without setting `req.userId` (silent pass-through).
  - If Bearer token is present and valid: sets `req.userId` and calls `next()`.
  - If Bearer token is present but malformed/expired: calls `next()` without setting `req.userId` (treats as guest, does NOT return 401). This avoids breaking the search experience for users with stale tokens.

### `server/src/middleware/rate-limit.ts`

- No changes needed. The `weatherLimiter` already uses `req.userId || req.ip || "unknown"` as the key generator, which naturally falls back to IP for guests.

## Client Changes

### `client/src/app.ts`

- Add a module-level `let isGuest = true` state variable.
- On startup (`init`), attempt `checkAuth()`. If it succeeds, set `isGuest = false` and show full app view (favorites, history, logout). If it fails, keep `isGuest = true` and call `showGuestAppView()` (search bar visible, no favorites/history/logout, login link shown).
- Modify `handleSearch`: wrap the `api.getFavorites()` call and `refreshFavoritesUI()` in `if (!isGuest) { ... }`. For guests, call `renderWeather` without favorite state (pass `isSaved: false`, `onToggleFavorite: undefined`).
- Modify `handleLogout`: instead of calling `showAuthView()`, set `isGuest = true` and call `showGuestAppView()`. The user returns to guest mode, not the auth wall. They can continue searching.
- Modify `renderWeatherWithFavorite`: if `isGuest`, always pass `isSaved: false` and `onToggleFavorite: undefined` — this causes the star button to not render (existing `renderWeather` only wires the star if `onToggleFavorite` is provided).
- Modify `handleToggleFavorite`: add early return if `isGuest` (should not be reachable, but defensive).
- Modify `handleHistoryToggle`: add early return if `isGuest` (defensive — button is hidden but guard is cheap).
- Add `handleLoginClick` function: calls `showAuthView()` to switch to the login/register form, and shows the "Continue as guest" link. Wire it to `onLoginClick` UI event.
- Add `handleGuestLink` function: calls `showGuestAppView()` to return from the auth form to guest mode. Wire it to `onGuestLink` UI event.
- Modify `showLoggedInApp`: set `isGuest = false`.

### `client/src/ui.ts`

- Add `showGuestAppView()` function: shows `.search-bar` (remove hidden class), shows `welcome-container`, hides `auth-container`, hides `favorites-container`, hides `history-button`, hides `logout-button`, hides `user-email` span, hides `weatherContainer`, hides `loadingContainer`, hides `errorContainer`, hides `historyContainer`, shows the login link element. This resets all transient state so that logging out from a searched state returns to a clean guest view.
- Add `onLoginClick(callback)` function: wires click listener on the login link element.
- Add `onGuestLink(callback)` function: wires click listener on the "Continue as guest" link element.
- Add `showGuestLink()` / `hideGuestLink()` helpers to show/hide the guest link in the auth form.
- Modify `renderWeather`: only render the `<button class="fav-star" ...>` when `onToggleFavorite` is provided. Use a ternary in the template literal: `${onToggleFavorite ? '<button class="..." ...>...</button>' : ''}`. When `undefined`, omit the star button entirely (guests see no star).

### `client/src/auth.ts`

- No changes needed. `fetchWithAuth` already sends requests without Authorization header when `accessToken` is null, and only retries on 401 when `accessToken` exists. This is the correct behavior for guests.

### `client/index.html`

- Add a "Login" link element in the header `.title-row`, after the theme toggle: `<a href="#" class="login-link hidden" id="login-link">Log in</a>`. Hidden by default, shown for guests by `showGuestAppView()`.
- Add a "Back to guest" link inside `auth-container`, below the auth form: `<a href="#" class="guest-link hidden" id="guest-link">Continue as guest</a>`. Hidden by default, shown by `showAuthView()` only when called after guest mode has been established (i.e., when the user clicks the login link). This gives users an escape hatch back to guest mode without refreshing. On first load (no prior guest session), the link is hidden since the user hasn't been in guest mode yet.

### `client/styles.css`

- Style for `.login-link`: matches header text style, cursor pointer, appropriate color.
- Style for `.guest-link`: centered below auth form, subtle link style.

## Testing

### Integration tests: modify `server/src/tests/integration/weather.test.ts`

- **Remove** the existing `"rejects unauthenticated requests"` test (it asserts search returns 401 without auth — this is now the opposite of expected behavior).
- **Add** test: `"allows unauthenticated weather search"` — `GET /api/weather/search?city=Denver&unit=celsius` without auth token returns 200.
- **Add** test: `"does not record search for unauthenticated users"` — search without token returns 200 but no history entry is created.
- Existing test: `GET /api/weather/history` without auth token still returns 401 (add explicit test if not present).

### E2E test: modify `e2e/tests/user-journey.spec.ts`

- **Update** the existing user journey test's post-logout assertion: after clicking logout, the user now enters guest mode (not auth view). Change the assertion from expecting `[data-testid="email-input"]` to be visible, to expecting `#login-link` to be visible and the search bar to be visible. The subsequent login flow should click the login link first, then fill credentials.
- **Add** a separate test: `"guest mode: search weather without logging in"` — visit `/`, verify search bar is visible, verify login link is visible, verify favorites/history/logout are hidden, search a city, verify `.current-weather` renders, verify no star button is shown.

## Files Changed

| File | Action |
|------|--------|
| `server/src/routes/weather.ts` | Modify — remove blanket `requireAuth`, add `optionalAuth` to router, add `requireAuth` to history only, conditional `recordSearch` |
| `server/src/middleware/auth.ts` | Modify — add `optionalAuth` middleware |
| `client/src/app.ts` | Modify — `isGuest` state, guest-aware `handleSearch`/`handleLogout`/`renderWeatherWithFavorite`, login click handler |
| `client/src/ui.ts` | Modify — add `showGuestAppView()`, `onLoginClick()`, conditional star button in `renderWeather` |
| `client/index.html` | Modify — add login link element |
| `client/styles.css` | Modify — login link styling |
| `server/src/tests/integration/weather.test.ts` | Modify — remove old 401 test, add unauthenticated search test, add history-still-requires-auth test |
| `e2e/tests/user-journey.spec.ts` | Modify — add guest mode E2E test |

## Out of Scope

- Guest favorites (localStorage-based)
- Guest search history
- Anonymous JWT tokens
- Guest-to-user migration (converting guest data on registration)
- Rate-limit changes (already handles guests via IP fallback)
