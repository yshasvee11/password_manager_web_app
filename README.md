# Zero-Knowledge Password Manager (Web)

A production-focused web password manager with a split-key, zero-knowledge design.  
All encryption/decryption happens in the browser, and the server never receives plaintext vault data.

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS v4
- Firebase Authentication
- Firebase Cloud Firestore
- Web Crypto API (AES-256-GCM, SHA-256)
- Argon2id via `argon2-browser` (WASM)
- `lucide-react` icons

## Security Model (High Level)

- User key is derived from master password using Argon2id.
- Final encryption key is derived client-side and used with AES-256-GCM.
- Ciphertext is split:
  - 60% stored remotely (Firestore)
  - 40% stored locally (`localStorage`)
- Neither shard alone is sufficient to decrypt vault data.

## Prerequisites

- Node.js 18+
- npm
- A Firebase project with:
  - Authentication enabled
  - Cloud Firestore enabled

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in `website_github/`:

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

3. Create Firebase config file:

```bash
copy src\\firebase\\config.example.ts src\\firebase\\config.ts
```

4. Start the dev server:

```bash
npm run dev
```

5. Open the local URL shown in terminal (usually `http://localhost:5173`).

## Build For Production

```bash
npm run build
```

Preview production build locally:

```bash
npm run preview
```

## Firebase API Key Visibility

Firebase web config values (including API key) are expected to be visible in frontend apps after publish.  
This is normal for Firebase client SDK usage.

Security should be enforced by:

- Firestore security rules
- Firebase Auth checks
- API key restrictions (HTTP referrer restrictions)
- Firebase App Check
- Strong client-side cryptography (already used here)

## Scripts

- `npm run dev` - start development server
- `npm run build` - production build
- `npm run preview` - preview production build
- `npm run lint` - lint code
- `npm run typecheck` - TypeScript type check

## Repository Structure

- `src/auth` - signup/login flows
- `src/components` - UI components
- `src/crypto` - cryptographic utilities
- `src/firebase` - Firebase initialization
- `src/storage` - split-storage logic
- `src/hooks` - app hooks (auto-lock, etc.)
- `public/argon2.wasm` - Argon2 WASM runtime

