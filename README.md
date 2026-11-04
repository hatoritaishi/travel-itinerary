# Travel note

A small, responsive Japanese itinerary viewer for GitHub Pages.

The initial page displays a password form. The itinerary payload is encrypted
with AES-256-GCM and a PBKDF2-SHA-256 derived key. The password and plaintext
itinerary are not stored in this repository. Decrypted data is held in memory
until the viewer is closed or reloaded. No analytics, third-party scripts,
account details, booking identifiers, payment details, or tracking are included.

A short numeric password is a convenience gate, not strong access control.
Public encrypted payloads can be downloaded and subjected to offline guesses.
Do not add confidential or identifying data to this viewer.

Deploy the repository root with GitHub Pages. No package installation or
custom GitHub Actions workflow is required. Serve over HTTPS for Web Crypto.

Files: `index.html`, `styles.css`, `app.js`, and encrypted `payload.json`.
