# Template sample photos - sources

Every photo here is CC0 (public domain dedication) - legally no attribution is required,
but the source is recorded anyway for traceability. Found and verified via Openverse
(openverse.org), which aggregates and validates CC-license metadata across sources;
resized/re-compressed locally (max 1920px long edge, JPEG q84) from the originals below.
None of these are AI-generated or watermarked stock; each was visually checked before use.

| File | Subject | Original source |
|---|---|---|
| `office-boardroom.jpg` | Empty modern boardroom, no people | https://www.flickr.com/photos/wocintechchat/32881037371 |
| `city-skyline.jpg` | Sydney CBD skyline with ferry | https://www.flickr.com/photos/25048521127 (Openverse: cc0) |
| `real-estate-house.jpg` | Two-story suburban house with "for sale" sign | rawpixel.com (cc0) |
| `restaurant-plating.jpg` | Restaurant kitchen, plating a dish | stocksnap.io (cc0) |
| `workspace-laptop.jpg` | Laptop + coffee on a desk | stocksnap.io (cc0) |

Used in `lib/presentation/designedTemplates.ts` (imported via `lib/presentation/assets.ts`,
resolved to real embedded image bytes at export time by `lib/presentation/renderDeck.ts`
and `lib/presentation/renderFlyer.ts` - see those files' comments for why a template can
reference `/presentation-assets/...` directly instead of a giant base64 string in source).
