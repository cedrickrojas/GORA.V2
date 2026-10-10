# Gora landing page

## Brand direction

Name: **GORA**. Tagline: **Find your game. Find your people. GORA!**

The interface follows the supplied reference: near-black backgrounds, charcoal cards, white headings, gray supporting text, and a strong orange accent (`#ff6028`). The full-width hero combines a basketball hoop photograph with a bold, condensed italic headline. The main wordmark uses an orange three-stripe mark. Supporting cards have restrained corners and subtle shadows, and transitions respect reduced-motion preferences. Sports icons and neutral avatar fallbacks replace the colorful gradients. Photo overlays are reserved for readability over sports imagery.

Brand text lives in `mobile/src/constants/brand.ts` and shared visual tokens in `mobile/src/theme/variables.css`.

The public `/` route introduces Gora and sends signup calls to action to `/register`. Signed-in visitors go to `/home`; existing app routes remain protected. The landing page and signed-in app are loaded separately.

The sports selector changes an illustrative game preview. Preview games, clubs, and dates are examples rather than live availability. No user counts or testimonials are claimed.

## Hero image

Current full-width hero: created with the built-in imagegen tool and saved as `mobile/public/images/gora-hoop.webp` (1672 × 941, approximately 92 KB) and `mobile/public/images/gora-hoop-small.webp` (1000 × 563, approximately 36 KB).

Final hoop-image prompt:

> Use case: photorealistic-natural. Asset type: wide cinematic background photograph for a premium black and orange sports landing page. Create a realistic indoor basketball hoop and an orange basketball suspended below it immediately after a made shot. Low upward sideline camera angle: a substantial worn dark graphite rectangular backboard cropped into the upper edge, vivid orange metal rim near the upper middle-right, physically realistic white woven net hanging prominently in the right half, orange pebbled basketball in the lower center-right. Almost black arena background with subtle warm amber bokeh far right. The left 40 percent is near-black negative space for white website headline; no people. Rich chiaroscuro sports campaign photography, high contrast, authentic texture, subdued professional atmosphere. Wide landscape 16:9 composition, hoop and basketball entirely within right 60 percent, room around the white net. No typography, UI, logos, watermarks, green accents or court scenery. Standalone photograph only.

The condensed headline font is self-hosted at `mobile/public/fonts/barlow-condensed-800-italic.woff2` (approximately 24 KB). Its open font license is saved alongside it as `OFL-barlow.txt`. No external font requests are needed at runtime.

The earlier court photograph remains a supporting sports asset:

Created with the built-in imagegen tool. The project serves local optimized WebP variants:

- `mobile/public/images/gora-court.webp` — 1536 × 1024, approximately 234 KB.
- `mobile/public/images/gora-court-small.webp` — 900 × 600, approximately 95 KB.

Final generation prompt:

> Use case: photorealistic-natural. Asset type: hero photograph for Gora, a sports community landing page. Primary request: cinematic candid editorial photograph of a friendly pickup basketball game on a neighborhood outdoor court in the Philippines. Four adult friends in understated unbranded athletic clothing playing, one in light lime shirt dribbling an orange basketball, others in dark navy and white shirts. Authentic court painted deep forest green with warm cream court markings, basketball hoop at upper right, tropical trees and low neighborhood buildings softly out of focus. Late-afternoon side lighting, warm highlights, natural athletic movement and anatomically correct bodies. Composition: landscape 3:2 with players and action occupying middle-right, generous visible court in foreground, shot from slightly elevated sideline. Color palette: deep green, navy, warm cream, subtle lime accents. Premium sports campaign photo with restrained film grain and realistic textures. No text, logos, brand marks or watermark. Output a standalone photograph, not a website mockup.

The original generated PNG is retained at its default imagegen destination; both production variants are saved in the project. The page uses responsive image selection, explicit dimensions, and high fetch priority for the hero. Other visuals use CSS and the existing Ionicons library.

## Accessibility

Navigation uses keyboard-accessible controls, the FAQs use native disclosure elements, and sport controls expose their selected state. A skip link, visible focus indicators, reduced-motion support, and browser zoom are included.
