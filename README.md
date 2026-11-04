# Travel note

A small, responsive Japanese itinerary viewer for GitHub Pages.

The initial page waits for the remembered login check before showing a password
form, so returning readers do not see a login-form flash. The itinerary payload is encrypted
with AES-256-GCM and a PBKDF2-SHA-256 derived key. The password and plaintext
itinerary are not stored in this repository. After a successful unlock, the
browser remembers a non-extractable, decrypt-only CryptoKey in IndexedDB and
automatically opens the same payload on later visits in that browser. The
password and decrypted itinerary are not persisted. Other devices/browsers,
cleared browser data, and payload key
changes require another unlock. If storage is unavailable, viewing still works
and the page reports that the login could not be remembered. No analytics, third-party scripts,
account details, booking identifiers, payment details, or tracking are included.

Spot explanations open in separate tabs using the `spot` query parameter.
Guide URLs retain the originating itinerary day. Prominent return links at
the top and bottom restore that day. Destination introductions, including
Akiyoshido Cave, Akiyoshidai Plateau, Hagi, Iwakuni, and Hiroshima, have large
cards above the day tabs, footer navigation, and a switcher between guides.
Blue underlined headings identify guide links.
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

A stationary mini Maro appears on 35% of page loads. Tapping plays the adopted
petting banzai; after 20–35 seconds without interaction, a random heart hug,
high-five, or cheek rub plays. Reading interaction interrupts idle gestures.
Artwork is loaded only when selected, with gesture assets loaded on demand.
Wide screens use the outer page gutter; narrow screens reserve normal layout
space beside the route or guide heading, including after content is added.
Standing Maro blinks at random 3–7 second intervals using adopted whole cels.
Reduced-motion settings use a still pose and skip automatic blinking.

Maro artwork is copied unchanged from adopted assets at source commit
`79737822383ce1fe933182af23346c7b6bb5e883`: standing, pet-banzai-v1,
heart-hug-v3, paw-wave-v1, and cheek-circles-soft-arms-v6. No walking or audio.

Files: `index.html`, `styles.css`, `app.js`, `remember.js`, encrypted `payload.json`,
`mini-maro.js`, `mini-maro-motion.js`, and `assets/mini-maro/`.
