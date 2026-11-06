# Club photo uploads and generated text

Create Club and Manage Club use file pickers for profile and cover photos. JPEG,
PNG and WebP source images up to 20 MB are decoded in the browser and resized to
at most 256 KiB each. Previews, change and remove actions operate on the draft;
navigation and saving wait until image preparation finishes.

POST `/api/v1/clubs` and PATCH `/api/v1/clubs/:id` accept `profilePhoto` and
`coverPhoto` as optimized data URLs. Null removes a photo; omitted fields retain
the existing photo. Older HTTP(S) image fields remain API-compatible. Sending
both an uploaded photo and a non-null URL for the same slot is rejected.

The existing authenticated club owner checks protect writes. Both photos and
club details save in one PostgreSQL transaction. `ClubPhoto` stores bounded bytes,
MIME type and revision, with a cascading club foreign key and one row per slot.
It uses no server filesystem, so images persist on Vercel. Club JSON returns only
photo paths. GET `/api/v1/clubs/:id/photos/:kind/:revision` serves identity images
of active clubs; replaced and removed revisions return 404. Website and social
links retain their original URL constraints.

Short descriptions and About drafts are generated locally from the entered club
name, sport, city, venue and membership type, in English or Filipino according to
the app preference. No external AI service or key is required. Generated text
updates as details change; manual edits are preserved. Generate buttons explicitly
replace the corresponding draft field. The short description stays within 160
characters. The final editable text is saved through the regular club API.

## Verification

From `mobile`:

`npm run test:unit -- tests/unit/club-media.spec.ts tests/unit/create-club-steps.spec.ts`

`npm run test:unit -- tests/unit/clubs.spec.ts -t "Create Club form"`

From `server`:

`npm run test:e2e -- --runInBand --testPathPatterns=club-photos`

API tests use temporary accounts and clubs in the configured development database
and delete them afterward. They cover persistent bytes, revision replacement,
removal, owner authorization, invalid files and rollback on an invalid second photo.
