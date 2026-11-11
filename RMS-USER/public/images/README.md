Image naming and placement guide for RMS

Place curated property images under the `public/images/` folder so the frontend can reliably use them.

Folder structure (recommended):

- /images/houses/
- /images/apartments/
- /images/flats/
- /images/hostels/
- /images/rooms/
- /images/properties/    (for miscellaneous or commercial listings)

Naming convention (required):

- Use the property ID (the `id` used in the app) as the basename, then a 1-based index for each photo.
- Format: `{propertyId}-{index}.jpg` (or .jpeg/.png/.webp)

Examples:

- House with id `101`:
  - /images/houses/101-1.jpg  <-- exterior / cover
  - /images/houses/101-2.jpg  <-- living room
  - /images/houses/101-3.jpg  <-- bedroom
  - /images/houses/101-4.jpg  <-- kitchen
  - /images/houses/101-5.jpg  <-- bathroom
  - /images/houses/101-6.jpg  <-- garden / parking
  - /images/houses/101-7.jpg  <-- balcony
  - /images/houses/101-8.jpg  <-- other

- Apartment with id `205`:
  - /images/apartments/205-1.jpg
  - /images/apartments/205-2.jpg
  - /images/apartments/205-3.jpg
  - ...

Recommended image counts by type (frontend expects these minima):

- House: 6–8 images (cover + exterior + living + bedroom + kitchen + bathroom + extras)
- Apartment: 5–6 images
- Flat: 4–6 images
- Hostel: 4–6 images
- Room: 3–5 images

Guidelines:

- Every property must have its own images; do not reuse the same image file across different property IDs.
- Filenames must be unique across folders (e.g., `101-1.jpg` in `houses/` is different to `101-1.jpg` in `apartments/`).
- Prefer high-quality photography with sensible aspect ratios (1200×800 recommended for hero/cover images).
- Use consistent naming (lowercase, hyphens, no spaces).
- Supported formats: `.jpg`, `.jpeg`, `.png`, `.webp`.

Fallback behavior:

- The app will attempt to load `/images/{category}/{id}-{n}.jpg` for each index up to the recommended count. If a local file is missing the browser will fall back to remote Unsplash-based images.
- If you want full offline or deterministic control, provide all required images locally following the naming pattern.

Verification checklist after copying images:

- Open Homepage, Properties, and Demo pages and confirm each property shows a distinct cover image.
- Open several property detail pages and confirm each gallery shows only images from that property folder.
- Ensure backgrounds/hero images are category-appropriate and not used as property images.

If you want, I can add a small Node script to scan `public/images/` and report missing or duplicate filenames across folders — tell me if you'd like that automated scanner.
