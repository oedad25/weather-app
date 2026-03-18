# Guest Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow unauthenticated users to search weather immediately without registering, gating favorites and history behind login.

**Architecture:** Add `optionalAuth` middleware that extracts user identity when present but doesn't require it. Remove blanket `requireAuth` from weather routes (keep it on history only). Client starts in guest mode by default — search bar visible, auth-only UI hidden, with a login link to switch to the auth form.

**Tech Stack:** Express middleware, vanilla TypeScript client, Vitest + Supertest for integration tests, Playwright for E2E.

**Spec:** `docs/superpowers/specs/2026-03-18-guest-mode-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `server/src/middleware/auth.ts` | Modify | Add `optionalAuth` middleware alongside existing `requireAuth` |
| `server/src/routes/weather.ts` | Modify | Replace blanket `requireAuth` with `optionalAuth` + per-route `requireAuth` on history |
| `server/src/tests/integration/weather.test.ts` | Modify | Remove old 401 test, add unauthenticated search/coords tests, add history-still-401 test |
| `client/index.html` | Modify | Add `#login-link` and `#guest-link` elements |
| `client/styles.css` | Modify | Add `.login-link` and `.guest-link` styles |
| `client/src/ui.ts` | Modify | Add `showGuestAppView`, `onLoginClick`, `onGuestLink`, `showGuestLink`, `hideGuestLink`; modify `renderWeather` for conditional star |
| `client/src/app.ts` | Modify | Add `isGuest` state, guest-aware handlers, login/guest link wiring |
| `e2e/tests/user-journey.spec.ts` | Modify | Update post-logout assertion, add guest mode test |

---

## Chunk 1: Server Changes

### Task 1: Add `optionalAuth` middleware

**Files:**
- Modify: `server/src/middleware/auth.ts`

- [ ] **Step 1: Add `optionalAuth` function to auth.ts**

Add after the existing `requireAuth` function (after line 27):

```typescript
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next();
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    req.userId = payload.userId;
  } catch {
    // Invalid/expired token — treat as guest, do not 401
  }
  next();
}
```

- [ ] **Step 2: Verify server builds**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add server/src/middleware/auth.ts
git commit -m "feat: add optionalAuth middleware for guest mode"
```

---

### Task 2: Update weather routes

**Files:**
- Modify: `server/src/routes/weather.ts`

- [ ] **Step 1: Update imports — add `optionalAuth`**

Change line 2 from:
```typescript
import { requireAuth } from "../middleware/auth.js";
```
to:
```typescript
import { requireAuth, optionalAuth } from "../middleware/auth.js";
```

- [ ] **Step 2: Replace blanket `requireAuth` with `optionalAuth`**

Change line 9 from:
```typescript
router.use(requireAuth);
```
to:
```typescript
router.use(optionalAuth);
```

- [ ] **Step 3: Add `requireAuth` to the history route only**

Change line 140:
```typescript
router.get("/history", async (req: Request, res: Response, next: NextFunction) => {
```
to:
```typescript
router.get("/history", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
```

- [ ] **Step 4: Make `recordSearch` conditional in search handler**

Replace lines 50–56 (the `recordSearch` call in the `/search` handler):
```typescript
    await weatherService.recordSearch(
      req.userId!,
      city,
      result.location.latitude,
      result.location.longitude,
      result.location.name,
    );
```
with:
```typescript
    if (req.userId) {
      await weatherService.recordSearch(
        req.userId,
        city,
        result.location.latitude,
        result.location.longitude,
        result.location.name,
      );
    }
```

- [ ] **Step 5: Make `recordSearch` conditional in coords handler**

Replace lines 101–107 (the `recordSearch` call in the `/coords` handler):
```typescript
    await weatherService.recordSearch(
      req.userId!,
      "[geolocation]",
      lat,
      lon,
      result.location.name,
    );
```
with:
```typescript
    if (req.userId) {
      await weatherService.recordSearch(
        req.userId,
        "[geolocation]",
        lat,
        lon,
        result.location.name,
      );
    }
```

- [ ] **Step 6: Verify server builds**

Run: `cd server && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/weather.ts
git commit -m "feat: remove blanket requireAuth from weather routes, conditional recordSearch"
```

---

### Task 3: Update integration tests

**Files:**
- Modify: `server/src/tests/integration/weather.test.ts`

- [ ] **Step 1: Remove the old "rejects unauthenticated requests" test**

Delete lines 21–24:
```typescript
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).get("/api/weather/search?city=Denver");
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 2: Add unauthenticated search, coords, history, and no-record tests**

Add in place of the deleted test (where the old "rejects unauthenticated requests" test was):

```typescript
  it("allows unauthenticated weather search (requires external API)", async () => {
    const res = await request(app)
      .get("/api/weather/search?city=Denver&unit=celsius");
    expect(res.status).not.toBe(401);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("location");
      expect(res.body).toHaveProperty("current");
    }
  });

  it("allows unauthenticated coords search (requires external API)", async () => {
    const res = await request(app)
      .get("/api/weather/coords?lat=39.7&lon=-104.9&unit=celsius");
    expect(res.status).not.toBe(401);
    if (res.status === 200) {
      expect(res.body).toHaveProperty("location");
      expect(res.body).toHaveProperty("current");
    }
  });

  it("does not record search for unauthenticated users", async () => {
    // Search without auth
    const searchRes = await request(app)
      .get("/api/weather/search?city=Denver&unit=celsius");
    expect(searchRes.status).not.toBe(401);

    // Verify no history was created — history requires auth, so check with a token
    const historyRes = await request(app)
      .get("/api/weather/history")
      .set("Authorization", `Bearer ${token}`);
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.total).toBe(0);
  });

  it("rejects unauthenticated history requests", async () => {
    const res = await request(app).get("/api/weather/history");
    expect(res.status).toBe(401);
  });
```

- [ ] **Step 3: Run integration tests**

Run: `cd server && npx vitest run src/tests/integration/weather.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add server/src/tests/integration/weather.test.ts
git commit -m "test: update weather tests for guest mode (unauthenticated search allowed)"
```

---

## Chunk 2: Client Changes

### Task 4: HTML and CSS updates

**Files:**
- Modify: `client/index.html`
- Modify: `client/styles.css`

- [ ] **Step 1: Add login link to header**

In `client/index.html`, after the theme toggle button (line 16), add:
```html
        <a href="#" class="login-link hidden" id="login-link">Log in</a>
```

So the `.title-row` becomes:
```html
      <div class="title-row">
        <h1 class="app-title">Sky <span>Check</span></h1>
        <button class="btn btn-icon" id="theme-toggle" title="Toggle theme">🌙</button>
        <a href="#" class="login-link hidden" id="login-link">Log in</a>
        <button class="btn btn-icon hidden" id="history-button" title="Search history">📋</button>
        <span class="user-email hidden" id="user-email"></span>
        <button class="btn btn-secondary hidden" id="logout-button" data-testid="logout-button">Logout</button>
      </div>
```

- [ ] **Step 2: Add "Continue as guest" link inside auth container**

In `client/index.html`, after the closing `</form>` tag (after line 46), add inside the `.auth-card` div:
```html
        <a href="#" class="guest-link hidden" id="guest-link">Continue as guest</a>
```

So the `auth-card` becomes:
```html
      <div class="auth-card">
        <h2 class="auth-title">Welcome to Sky<span>Check</span></h2>
        <form id="auth-form" class="auth-form">
          <input type="email" id="auth-email" data-testid="email-input" placeholder="Email" required autocomplete="email">
          <input type="password" id="auth-password" data-testid="password-input" placeholder="Password (min 8 chars)" required minlength="8">
          <div class="auth-buttons">
            <button type="submit" class="btn btn-primary" id="login-button" data-testid="login-button">Log In</button>
            <button type="button" class="btn btn-secondary" id="register-button" data-testid="register-button">Register</button>
          </div>
          <p id="auth-error" class="auth-error hidden"></p>
        </form>
        <a href="#" class="guest-link hidden" id="guest-link">Continue as guest</a>
      </div>
```

- [ ] **Step 3: Add CSS styles for login link and guest link**

Add to the end of `client/styles.css`:

```css
/* ===========================================
   Guest Mode Links
   =========================================== */

.login-link {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-accent);
  text-decoration: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  transition: background 0.2s;
}

.login-link:hover {
  background: var(--color-accent-soft);
  text-decoration: underline;
}

.guest-link {
  display: block;
  text-align: center;
  margin-top: 16px;
  font-family: var(--font-body);
  font-size: 0.85rem;
  color: var(--color-text-muted);
  text-decoration: none;
  cursor: pointer;
}

.guest-link:hover {
  color: var(--color-accent);
  text-decoration: underline;
}
```

- [ ] **Step 4: Commit**

```bash
git add client/index.html client/styles.css
git commit -m "feat: add login link and guest link HTML/CSS for guest mode"
```

---

### Task 5: UI functions for guest mode

**Files:**
- Modify: `client/src/ui.ts`

- [ ] **Step 1: Add DOM references for new elements**

After line 103 (after `historyClose` declaration), add:

```typescript
const loginLink = document.getElementById("login-link") as HTMLAnchorElement;
const guestLink = document.getElementById("guest-link") as HTMLAnchorElement;
```

- [ ] **Step 2: Add `showGuestAppView` function**

After the `showAppView` function (after line 438), add:

```typescript
export function showGuestAppView(): void {
  authContainer.classList.add("hidden");
  logoutButton.classList.add("hidden");
  userEmailSpan.classList.add("hidden");
  historyButton.classList.add("hidden");
  favoritesContainer.classList.add("hidden");
  weatherContainer.classList.add("hidden");
  loadingContainer.classList.add("hidden");
  errorContainer.classList.add("hidden");
  historyContainer.classList.add("hidden");
  loginLink.classList.remove("hidden");
  document.querySelector(".search-bar")?.classList.remove("hidden");
  welcomeContainer.classList.remove("hidden");
}
```

- [ ] **Step 3: Add `onLoginClick` and `onGuestLink` event wiring functions**

After `showGuestAppView`, add:

```typescript
export function onLoginClick(callback: () => void): void {
  loginLink.addEventListener("click", (e) => {
    e.preventDefault();
    callback();
  });
}

export function onGuestLink(callback: () => void): void {
  guestLink.addEventListener("click", (e) => {
    e.preventDefault();
    callback();
  });
}

export function showGuestLink(): void {
  guestLink.classList.remove("hidden");
}

export function hideGuestLink(): void {
  guestLink.classList.add("hidden");
}
```

- [ ] **Step 4: Modify `showAuthView` to hide login link**

In the existing `showAuthView` function (line 414), add after `document.querySelector(".search-bar")?.classList.add("hidden");` (line 427):

```typescript
  loginLink.classList.add("hidden");
  hideGuestLink();
```

- [ ] **Step 5: Modify `showAppView` to hide login link**

In the existing `showAppView` function (line 430), add after `authContainer.classList.add("hidden");` (line 431):

```typescript
  loginLink.classList.add("hidden");
```

- [ ] **Step 6: Modify `renderWeather` for conditional star button**

In `renderWeather` (lines 340–355), replace the star button section:

```typescript
  // Star button: filled ★ if saved, outline ☆ if not
  const starIcon = isSaved ? "★" : "☆";
  const starTitle = isSaved ? "Remove from favorites" : "Save to favorites";
  const starClass = isSaved ? "fav-star saved" : "fav-star";
```

and the button in the template literal (line 355):
```html
        <button class="${starClass}" id="fav-toggle" title="${starTitle}">${starIcon}</button>
```

with:

```typescript
  // Star button: only shown when onToggleFavorite callback is provided (logged-in users)
  const starHtml = onToggleFavorite
    ? `<button class="${isSaved ? "fav-star saved" : "fav-star"}" id="fav-toggle" title="${isSaved ? "Remove from favorites" : "Save to favorites"}">${isSaved ? "★" : "☆"}</button>`
    : "";
```

and use `${starHtml}` in the template literal where the button was:
```html
        ${starHtml}
```

- [ ] **Step 7: Build client to verify**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add client/src/ui.ts
git commit -m "feat: add guest mode UI functions and conditional star button"
```

---

### Task 6: App coordinator guest mode logic

**Files:**
- Modify: `client/src/app.ts`

- [ ] **Step 1: Update imports from ui.ts**

Replace the import block (lines 3–24):
```typescript
import {
  onSearch,
  onUnitToggle,
  onGeolocate,
  onThemeToggle,
  onLogin,
  onRegister,
  onLogout,
  onHistoryToggle,
  setGeoButtonLoading,
  showLoading,
  showError,
  renderWeather,
  renderFavorites,
  renderHistory,
  updateUnitToggle,
  applyTheme,
  showAuthView,
  showAppView,
  showAuthError,
  clearAuthError,
} from "./ui.js";
```

with:

```typescript
import {
  onSearch,
  onUnitToggle,
  onGeolocate,
  onThemeToggle,
  onLogin,
  onRegister,
  onLogout,
  onHistoryToggle,
  onLoginClick,
  onGuestLink,
  setGeoButtonLoading,
  showLoading,
  showError,
  renderWeather,
  renderFavorites,
  renderHistory,
  updateUnitToggle,
  applyTheme,
  showAuthView,
  showAppView,
  showGuestAppView,
  showGuestLink,
  showAuthError,
  clearAuthError,
} from "./ui.js";
```

- [ ] **Step 2: Add `isGuest` state variable**

After `let favorites: any[] = [];` (line 32), add:

```typescript
let isGuest = true;
```

- [ ] **Step 3: Modify `handleLogout` — go to guest mode instead of auth view**

Replace the `handleLogout` function (lines 56–62):
```typescript
async function handleLogout(): Promise<void> {
  await auth.logout();
  lastLocation = null;
  lastWeatherData = null;
  favorites = [];
  showAuthView();
}
```

with:

```typescript
async function handleLogout(): Promise<void> {
  await auth.logout();
  lastLocation = null;
  lastWeatherData = null;
  favorites = [];
  isGuest = true;
  showGuestAppView();
}
```

- [ ] **Step 4: Modify `showLoggedInApp` — set `isGuest = false`**

In `showLoggedInApp` (line 64), add `isGuest = false;` as the first line:

```typescript
async function showLoggedInApp(email: string): Promise<void> {
  isGuest = false;
  showAppView(email);
  try {
    favorites = await api.getFavorites();
    refreshFavoritesUI();
  } catch {
    // Favorites failed to load, not critical
  }
}
```

- [ ] **Step 5: Add defensive guards to `handleToggleFavorite` and `handleHistoryToggle`**

Add at the start of `handleToggleFavorite` (line 114), before the existing `if` check:

```typescript
  if (isGuest) return;
```

Add at the start of `handleHistoryToggle` (line 241):

```typescript
  if (isGuest) return;
```

- [ ] **Step 6: Modify `renderWeatherWithFavorite` for guest mode**

Replace the `renderWeatherWithFavorite` function (lines 138–147):
```typescript
function renderWeatherWithFavorite(weather: WeatherData): void {
  const isSaved = lastLocation
    ? favorites.some(
        (f) =>
          Math.abs(f.latitude - lastLocation!.latitude) < 0.01 &&
          Math.abs(f.longitude - lastLocation!.longitude) < 0.01
      )
    : false;
  renderWeather(weather, currentUnit, isSaved, handleToggleFavorite);
}
```

with:

```typescript
function renderWeatherWithFavorite(weather: WeatherData): void {
  if (isGuest) {
    renderWeather(weather, currentUnit, false);
    return;
  }
  const isSaved = lastLocation
    ? favorites.some(
        (f) =>
          Math.abs(f.latitude - lastLocation!.latitude) < 0.01 &&
          Math.abs(f.longitude - lastLocation!.longitude) < 0.01
      )
    : false;
  renderWeather(weather, currentUnit, isSaved, handleToggleFavorite);
}
```

- [ ] **Step 7: Modify `handleSearch` — skip favorites for guests**

Replace lines 161–163 in `handleSearch`:
```typescript
    renderWeatherWithFavorite(result as any);
    favorites = await api.getFavorites();
    refreshFavoritesUI();
```

with:

```typescript
    renderWeatherWithFavorite(result as any);
    if (!isGuest) {
      favorites = await api.getFavorites();
      refreshFavoritesUI();
    }
```

- [ ] **Step 8: Add `handleLoginClick` and `handleGuestLink` functions**

After `handleHistoryToggle` (before the `// --- Init ---` comment), add:

```typescript
function handleLoginClick(): void {
  showAuthView();
  showGuestLink();
}

function handleGuestLink(): void {
  showGuestAppView();
}
```

- [ ] **Step 9: Wire new events and update init**

In the `init` function, after the `onHistoryToggle(handleHistoryToggle);` line (line 266), add:

```typescript
  onLoginClick(handleLoginClick);
  onGuestLink(handleGuestLink);
```

Replace lines 268–282 in `init` (keep the closing `}` on line 283):
```typescript
  // Check if already logged in
  const isLoggedIn = await auth.checkAuth();
  if (isLoggedIn) {
    try {
      const res = await auth.fetchWithAuth("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        await showLoggedInApp(data.user.email);
        return;
      }
    } catch {
      // Fall through to show auth
    }
  }
  showAuthView();
```

with:

```typescript
  // Check if already logged in
  const isLoggedIn = await auth.checkAuth();
  if (isLoggedIn) {
    try {
      const res = await auth.fetchWithAuth("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        await showLoggedInApp(data.user.email);
        return;
      }
    } catch {
      // Fall through to guest mode
    }
  }
  isGuest = true;
  showGuestAppView();
```

- [ ] **Step 10: Build client to verify**

Run: `cd client && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add client/src/app.ts
git commit -m "feat: add guest mode logic to app coordinator"
```

---

## Chunk 3: E2E Tests

### Task 7: Update E2E tests

**Files:**
- Modify: `e2e/tests/user-journey.spec.ts`

- [ ] **Step 1: Update existing test's post-logout and re-login flow**

In the existing test, replace lines 40–48:

```typescript
    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();

    // Login
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
```

with:

```typescript
    // Logout — should go to guest mode, not auth wall
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator("#login-link")).toBeVisible();
    await expect(page.locator(".search-bar")).toBeVisible();

    // Click login link to show auth form, then login
    await page.click("#login-link");
    await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
```

- [ ] **Step 2: Add guest mode test**

After the existing test (before the closing `});` of the describe block), add:

```typescript
  test("guest mode: search weather without logging in", async ({ page }) => {
    await page.goto("/");

    // Guest mode: search bar and login link visible, auth-only UI hidden
    await expect(page.locator(".search-bar")).toBeVisible();
    await expect(page.locator("#login-link")).toBeVisible();
    await expect(page.locator('[data-testid="logout-button"]')).not.toBeVisible();
    await expect(page.locator("#history-button")).not.toBeVisible();
    await expect(page.locator("#favorites-container")).not.toBeVisible();

    // Search for a city
    await page.fill("#search-input", "Denver");
    await page.click("#search-button");
    await expect(page.locator(".current-weather")).toBeVisible({ timeout: 10000 });

    // No star button for guests
    await expect(page.locator("#fav-toggle")).not.toBeVisible();
  });
```

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/user-journey.spec.ts
git commit -m "test: update E2E tests for guest mode"
```
