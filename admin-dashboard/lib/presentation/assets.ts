/** Named paths into public/presentation-assets/ (see that folder's SOURCES.md for
 * licensing - every one is CC0) - the curated sample photography built-in templates use
 * so a downloaded deck/flyer looks like a finished, ready-to-send piece rather than an
 * empty placeholder skeleton. Referenced as a plain "/presentation-assets/..." path, the
 * same way any Next.js public asset is: works as-is in the browser (SlideCanvas.tsx,
 * FlyerCanvas.tsx just set it as an <img src>), and is resolved to real embedded image
 * bytes at export time by lib/presentation/assetResolve.ts - so no template file needs a
 * giant base64 string inlined in its source. */
export const SAMPLE_IMAGES = {
  officeBoardroom: "/presentation-assets/office-boardroom.jpg",
  citySkyline: "/presentation-assets/city-skyline.jpg",
  realEstateHouse: "/presentation-assets/real-estate-house.jpg",
  restaurantPlating: "/presentation-assets/restaurant-plating.jpg",
  workspaceLaptop: "/presentation-assets/workspace-laptop.jpg",
} as const;
