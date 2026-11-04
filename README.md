# Travel note

A small, responsive Japanese itinerary viewer for GitHub Pages.

The initial page waits for the remembered login check before showing a password
form, so returning readers do not see a login-form flash. The itinerary payload is encrypted
with AES-256-GCM and a PBKDF2-SHA-256 derived key. The password and plaintext
itinerary are not stored in this repository. After a successful unlock, the
browser remembers a non-extractable, decrypt-only CryptoKey in IndexedDB and
automatically opens the same payload on later visits in that browser. The
password and decrypted itinerary are not persisted. Logging out deletes the
remembered key. Other devices/browsers, cleared browser data, and payload key
changes require another unlock. If storage is unavailable, viewing still works
and the page reports that the login could not be remembered. No analytics, third-party scripts,
account details, booking identifiers, payment details, or tracking are included.

Spot explanations open in separate tabs using the `spot` query parameter.
They are included in the encrypted payload and use the same viewing key.
Sightseeing and hotel headings link directly to illustrated guides, including
grouped places. Guides link to official websites; the station guide focuses on
souvenirs and shops. Photographs retain source credits and license links where
applicable. Timeline times and alternate routes are independent of the guide content.

A short numeric password is a convenience gate, not strong access control.
Public encrypted payloads can be downloaded and subjected to offline guesses.
Do not add confidential or identifying data to this viewer.

Deploy the repository root with GitHub Pages. No package installation or
custom GitHub Actions workflow is required. Serve over HTTPS for Web Crypto.

Files: `index.html`, `styles.css`, `app.js`, `remember.js`, and encrypted `payload.json`.
