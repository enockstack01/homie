import type { SlidePlan } from "./outline";
import type { Slide } from "./elements";
import { pitchDeckModern, pitchDeckClassic, marketingReport, caseStudy, minimalist } from "./designedTemplates";
import { weddingInvitationClassic, weddingInvitationModern, weddingInvitationBotanical, WEDDING_INVITATION_LAYOUT } from "./invitations";
import { SAMPLE_IMAGES } from "./assets";

/**
 * Real starting templates - unlike app/api/generate/route.ts's path, these never call the
 * AI gateway at all: each is either a hand-authored SlidePlan[]/FlyerContent literal
 * (rendered through elements.ts's slideFromPlan, always the same title+body layout) or,
 * for the bespoke-designed decks below, a `build` function returning a fully custom
 * Slide[] straight from lib/presentation/designedTemplates.ts. Both paths render through
 * the same deterministic renderDeck.ts/renderFlyer.ts the AI path uses. That's deliberate
 * - a template should download instantly, work with no API key, and never cost credits,
 * the same way picking a Canva template does.
 *
 * Every template's copy is written as a specific, real-sounding scenario (a named
 * company, person, address, or event) rather than bracketed placeholders like
 * "[Founder Name]" - the default preview should already read as a finished document, not
 * a form. Editing replaces good content with the user's own, it never fills an obvious
 * blank for the first time.
 */

export interface FlyerContent {
  headline: string;
  subheadline?: string;
  body: string[];
  cta?: string;
  footer?: string;
  /** A "/presentation-assets/..." path (lib/presentation/assets.ts) or a user-uploaded
   * data: URI - fills the flyer's top zone as a real photo instead of flat color, see
   * renderFlyer.ts/FlyerCanvas.tsx. Optional - existing text-only flyers are unaffected. */
  imageUrl?: string;
}

export type Template =
  | { id: string; kind: "deck"; name: string; description: string; slides: SlidePlan[]; coverImage?: string }
  | {
      id: string;
      kind: "deck";
      name: string;
      description: string;
      build: (primary: string, accent: string) => Slide[];
      /** Overrides the normal 16:9 deck canvas - a real print-format page size (see
       * printFormats.ts), for documents like the wedding invitation suite that are pages
       * meant to be printed at an exact trim size, not slides meant to be presented. */
      layout?: { widthIn: number; heightIn: number };
    }
  | { id: string; kind: "flyer"; name: string; description: string; content: FlyerContent };

export const TEMPLATES: Template[] = [
  {
    id: "business-pitch",
    kind: "deck",
    name: "Business Pitch",
    description: "Cover, problem, solution, market, team, the ask.",
    slides: [
      { title: "Harborline Logistics", bullets: ["Real-time freight visibility for mid-size shippers", "Presented by Dana Whitfield, Founder & CEO"] },
      {
        title: "The Problem",
        bullets: [
          "Mid-size shippers lose an average of 6 hours a week tracking freight across five different carrier portals",
          "Late-delivery penalties cost the average shipper $180K a year",
          "Enterprise tracking platforms start at $50K/year - out of reach for this segment",
        ],
      },
      {
        title: "Our Solution",
        bullets: [
          "One dashboard that pulls live status from 40+ carriers automatically",
          "Delay alerts land 6-12 hours before the carrier's own notification",
          "Setup takes under a day, no EDI integration required",
        ],
      },
      {
        title: "Market Opportunity",
        bullets: [
          "$4.8B market: 28,000 US shippers moving 50-500 loads a month",
          "First customers: regional produce and building-materials distributors",
          "Freight visibility spend is growing 22% a year as shippers absorb more carrier risk",
        ],
      },
      { title: "Team", bullets: ["Dana Whitfield - 9 years at C.H. Robinson, led carrier ops", "Marcus Ilori - ex-Flexport engineering lead", "Priya Nair - advisor, 3 prior logistics-tech exits"] },
      { title: "The Ask", bullets: ["Raising $2.5M seed", "18 months of runway to reach 200 paying shippers", "Unlocks: full-time sales team, SOC 2 certification"] },
    ],
    coverImage: SAMPLE_IMAGES.officeBoardroom,
  },
  {
    id: "pitch-deck-modern",
    kind: "deck",
    name: "Pitch Deck (Modern)",
    description: "Bold typography, bento-grid stats, one big number per slide - 2026's investor-deck look.",
    build: pitchDeckModern,
  },
  {
    id: "pitch-deck-classic",
    kind: "deck",
    name: "Pitch Deck (Classic)",
    description: "Editorial serif typography, framed portrait grid, understated - a different visual direction from Modern's bento grid.",
    build: pitchDeckClassic,
  },
  {
    id: "marketing-report",
    kind: "deck",
    name: "Marketing Report",
    description: "KPI bento grid, a real chart, and a pull-quote slide.",
    build: marketingReport,
  },
  {
    id: "case-study",
    kind: "deck",
    name: "Case Study",
    description: "Real photography cover, challenge/solution split, results, gallery.",
    build: caseStudy,
  },
  {
    id: "wedding-invitation-classic",
    kind: "deck",
    name: "Wedding Invitation (Classic)",
    description: "A coordinated 3-piece suite - invitation, RSVP card, and details card - at true 5\"x7\" print size with bleed, formal serif and script typography, and a hand-inked frame.",
    build: () => weddingInvitationClassic(),
    layout: WEDDING_INVITATION_LAYOUT,
  },
  {
    id: "wedding-invitation-modern",
    kind: "deck",
    name: "Wedding Invitation (Modern Minimal)",
    description: "The same true 5\"x7\" print suite, restyled: left-aligned geometric type, one thin rule instead of a frame, and generous whitespace.",
    build: () => weddingInvitationModern(),
    layout: WEDDING_INVITATION_LAYOUT,
  },
  {
    id: "wedding-invitation-botanical",
    kind: "deck",
    name: "Wedding Invitation (Botanical)",
    description: "The same true 5\"x7\" print suite, restyled: loose asymmetric greenery corners, script names, and a soft garden palette.",
    build: () => weddingInvitationBotanical(),
    layout: WEDDING_INVITATION_LAYOUT,
  },
  {
    id: "minimalist",
    kind: "deck",
    name: "Minimalist",
    description: "Huge quiet typography, no decoration at all - type as the whole design.",
    build: (primary) => minimalist(primary),
  },
  {
    id: "project-status",
    kind: "deck",
    name: "Project Status Report",
    description: "Cover, summary, progress, risks, next steps.",
    slides: [
      { title: "Atlas CRM Migration", bullets: ["Status report - reporting period: March 1-31"] },
      {
        title: "Executive Summary",
        bullets: [
          "Overall status: on track for the April 18 cutover",
          "Sales team pilot completed with a 94% satisfaction score",
          "Leadership decision needed on the legacy-data retention window by April 5",
        ],
      },
      {
        title: "Progress This Period",
        bullets: ["Contact and deal-history migration - complete", "Custom field mapping (140 fields) - complete", "Sales team training (3 of 4 sessions) - in progress"],
      },
      {
        title: "Risks & Blockers",
        bullets: [
          "Salesforce API rate limits are slowing the final data sync - mitigated by running it overnight",
          "Two integrations (Marketo, Gong) still need re-authentication after cutover",
          "Decision needed: keep the old CRM read-only for 90 days, or export and retire it immediately",
        ],
      },
      { title: "Next Steps", bullets: ["Finish sales training - owner: Priya Rao, target April 8", "Run the final data sync rehearsal - owner: Tomas Berg, target April 12", "Go-live cutover - April 18, 6pm"] },
    ],
    coverImage: SAMPLE_IMAGES.citySkyline,
  },
  {
    id: "team-update",
    kind: "deck",
    name: "Team Update",
    description: "Cover, highlights, metrics, blockers, thanks.",
    slides: [
      { title: "Product Design Team", bullets: ["Weekly update - week of March 24"] },
      { title: "Highlights", bullets: ["Shipped the new onboarding flow - early signup completion up 15%", "Design system component library hit 80 components", "Wrapped user interviews for the mobile redesign"] },
      { title: "Key Metrics", bullets: ["Onboarding completion: 68%, up from 53% last month", "Support tickets tagged 'confusing UI': 12, down from 31", "Design review turnaround: 1.4 days, down from 2.6"] },
      { title: "Blockers", bullets: ["Waiting on brand guideline sign-off from marketing to finalize the color system", "Need one more mobile engineer to keep pace with the redesign backlog"] },
      { title: "Thank You", bullets: ["Shoutout to Elena for carrying the onboarding project solo through the holidays", "Questions? Drop them in #product-design"] },
    ],
    coverImage: SAMPLE_IMAGES.workspaceLaptop,
  },
  {
    id: "product-launch",
    kind: "deck",
    name: "Product Launch",
    description: "Cover, problem, product, features, roadmap.",
    slides: [
      { title: "Introducing Aurora", bullets: ["Launching May 6"] },
      { title: "The Problem", bullets: ["Knowledge workers spend 2.5 hours a day rewriting the same emails, briefs, and updates in a slightly different voice each time"] },
      { title: "The Product", bullets: ["Aurora learns your writing voice from 10 past documents", "Drafts emails, briefs, and updates that already sound like you", "Built for teams who write for a living - support, sales, and marketing"] },
      { title: "Key Features", bullets: ["Voice matching from your own past writing", "One-click tone shift: formal, friendly, concise", "Works inside Gmail, Docs, and Slack"] },
      { title: "What's Next", bullets: ["Team voice-sharing rolls out in Q3", "Early access is open now at aurora.app/early-access"] },
    ],
    coverImage: SAMPLE_IMAGES.citySkyline,
  },
  {
    id: "lesson-plan",
    kind: "deck",
    name: "Educational Lesson",
    description: "Cover, objectives, content, recap, questions.",
    slides: [
      { title: "Introduction to Photosynthesis", bullets: ["Grade 7 Science - Ms. Alvarado"] },
      { title: "Learning Objectives", bullets: ["Explain what photosynthesis converts, and into what", "Identify the role of chlorophyll and sunlight", "Describe why photosynthesis matters for every food chain"] },
      { title: "Key Concept 1: Inputs and Outputs", bullets: ["Plants take in carbon dioxide and water", "Sunlight provides the energy for the reaction", "Output: glucose (food) and oxygen"] },
      { title: "Key Concept 2: Where It Happens", bullets: ["Photosynthesis happens inside chloroplasts", "Chlorophyll is what makes leaves green - and what captures sunlight", "Most photosynthesis happens in the leaves, not the stem or roots"] },
      { title: "Recap", bullets: ["Photosynthesis turns sunlight, water, and CO2 into food and oxygen", "Next class: how animals depend on this process"] },
      { title: "Questions?", bullets: ["Let's discuss - what would happen to Earth's oxygen if plants disappeared?"] },
    ],
    coverImage: SAMPLE_IMAGES.classroomChalkboard,
  },
  {
    id: "blank-deck",
    kind: "deck",
    name: "Blank Deck",
    description: "A cover slide and one content slide - just a starting point.",
    slides: [{ title: "Slide Title", bullets: ["First point", "Second point", "Third point"] }],
  },
  {
    id: "event-flyer",
    kind: "flyer",
    name: "Event Flyer",
    description: "Headline, date/time/location, description, call to action.",
    content: {
      headline: "You're Invited",
      subheadline: "Riverside Summer Music Festival",
      body: ["Saturday, July 12 at 4:00 PM", "Riverside Park Amphitheater, 220 Water Street", "Six local bands, food trucks, and a sunset headline set"],
      cta: "Get tickets at riversidefest.com",
      footer: "Hosted by the Riverside Arts Council",
      imageUrl: SAMPLE_IMAGES.eventCrowd,
    },
  },
  {
    id: "promo-flyer",
    kind: "flyer",
    name: "Promotional Flyer",
    description: "Offer headline, details, call to action.",
    content: {
      headline: "20% Off Your First Order",
      subheadline: "New customers only, this month",
      body: ["Applies to any bag of whole-bean or ground coffee", "Use code FIRST20 at checkout", "One use per customer, expires the 30th"],
      cta: "Shop now at northsideroasters.com",
      footer: "Northside Coffee Roasters, 118 Elm Street",
    },
  },
  {
    id: "real-estate-flyer",
    kind: "flyer",
    name: "Real Estate Listing",
    description: "A real listing photo, price callout, features, and contact.",
    content: {
      headline: "482 Willow Creek Lane",
      subheadline: "$525,000  ·  Asheville, NC",
      body: ["4 beds  ·  3 baths  ·  2,640 sq ft", "Fully renovated kitchen with quartz counters", "Half-acre lot backing onto Willow Creek greenway"],
      cta: "Schedule a showing: (828) 555-0148",
      footer: "Maria Chen  ·  Blue Ridge Realty  ·  License #294817",
      imageUrl: SAMPLE_IMAGES.realEstateHouse,
    },
  },
  {
    id: "restaurant-flyer",
    kind: "flyer",
    name: "Restaurant Special",
    description: "A plated-dish photo, offer headline, and details.",
    content: {
      headline: "Autumn Harvest Tasting Menu",
      subheadline: "The Copper Fork",
      body: ["Seared scallops with brown butter squash puree", "Braised short rib, root vegetables, red wine jus", "$68 per person, wine pairing available for $28"],
      cta: "Reserve at (312) 555-0199 or thecopperfork.com",
      footer: "412 Lakeshore Drive  ·  Tue-Sun, 5-10pm",
      imageUrl: SAMPLE_IMAGES.restaurantPlating,
    },
  },
  {
    id: "announcement-flyer",
    kind: "flyer",
    name: "Announcement Flyer",
    description: "Headline, body copy, contact info.",
    content: {
      headline: "We're Moving to a New Location",
      body: [
        "Starting April 1, Riverside Design Studio will be at 88 Harbor View, Suite 300",
        "Same phone number and email, same team",
        "Open house to celebrate the new space on April 5, 5-8pm - all welcome",
      ],
      footer: "Questions? hello@riversidedesignstudio.com  ·  (415) 555-0172",
    },
  },
  {
    id: "blank-flyer",
    kind: "flyer",
    name: "Blank Flyer",
    description: "A headline and one body line - just a starting point.",
    content: {
      headline: "Headline",
      body: ["First point"],
    },
  },
];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
