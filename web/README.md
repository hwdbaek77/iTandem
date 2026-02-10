# iTandem Web UI

MVP frontend scaffold for the iTandem web app using Next.js App Router and Tailwind CSS.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open:

`http://localhost:3000`

## Project structure

```text
web/
  app/
    carpool/page.js      # /carpool
    login/page.js        # /login (no header/nav)
    parking/page.js      # /parking
    profile/page.js      # /profile
    globals.css          # global styles + theme tokens
    layout.js            # root layout
    page.js              # / (home)
  components/
    AppShell.js          # header + content + bottom nav shell
    BottomNav.js         # bottom tab navigation
    Header.js            # top branding header
```

## Design tokens

- Background: `#0D0D0D`
- Card: `#1A1A1A`
- Accent (HW crimson): `#C41E3A`
- Accent hover: `#A3182F`
- Text: `#FFFFFF`
- Muted text/icons: `#6B7280`

## Routes

- `/` - Home
- `/carpool` - Find Carpool
- `/parking` - Find Parking
- `/profile` - Profile Settings
- `/login` - Standalone login stub (no app shell)
