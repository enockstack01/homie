import type { SlidePlan } from "./outline";

/**
 * Real starting templates - unlike app/api/generate/route.ts's path, these never call the
 * AI gateway at all: each is a hand-authored SlidePlan[]/FlyerContent literal, rendered
 * straight through the same deterministic renderers (renderDeck.ts/renderFlyer.ts) the AI
 * path uses. That's deliberate - a template should download instantly, work with no API
 * key, and never cost credits, the same way picking a Canva template does.
 */

export interface FlyerContent {
  headline: string;
  subheadline?: string;
  body: string[];
  cta?: string;
  footer?: string;
}

export type Template =
  | { id: string; kind: "deck"; name: string; description: string; slides: SlidePlan[] }
  | { id: string; kind: "flyer"; name: string; description: string; content: FlyerContent };

export const TEMPLATES: Template[] = [
  {
    id: "business-pitch",
    kind: "deck",
    name: "Business Pitch",
    description: "Cover, problem, solution, market, team, the ask.",
    slides: [
      { title: "Company Name", bullets: ["One-line description of what you do", "Presented by [Your Name]"] },
      {
        title: "The Problem",
        bullets: ["What's broken today", "Who feels this pain, and how often", "Why existing options fall short"],
      },
      {
        title: "Our Solution",
        bullets: ["What you built", "Why it's different", "The core value in one sentence"],
      },
      {
        title: "Market Opportunity",
        bullets: ["Total addressable market size", "Who your first customers are", "Why now"],
      },
      { title: "Team", bullets: ["Founder backgrounds", "Relevant experience", "Why this team wins"] },
      { title: "The Ask", bullets: ["How much you're raising", "What it funds", "Milestones it unlocks"] },
    ],
  },
  {
    id: "project-status",
    kind: "deck",
    name: "Project Status Report",
    description: "Cover, summary, progress, risks, next steps.",
    slides: [
      { title: "Project Status Report", bullets: ["[Project name]", "Reporting period: [date range]"] },
      {
        title: "Executive Summary",
        bullets: ["Overall status: on track / at risk / delayed", "Headline outcome this period", "One thing leadership should know"],
      },
      {
        title: "Progress This Period",
        bullets: ["Milestone 1 - status", "Milestone 2 - status", "Milestone 3 - status"],
      },
      {
        title: "Risks & Blockers",
        bullets: ["Risk 1 - impact and mitigation", "Risk 2 - impact and mitigation", "Decisions needed from leadership"],
      },
      { title: "Next Steps", bullets: ["Priority for next period", "Owner and target date", "Support needed"] },
    ],
  },
  {
    id: "team-update",
    kind: "deck",
    name: "Team Update",
    description: "Cover, highlights, metrics, blockers, thanks.",
    slides: [
      { title: "Team Update", bullets: ["[Team name]", "[Date]"] },
      { title: "Highlights", bullets: ["Win #1", "Win #2", "Win #3"] },
      { title: "Key Metrics", bullets: ["Metric 1: value, trend", "Metric 2: value, trend", "Metric 3: value, trend"] },
      { title: "Blockers", bullets: ["What's slowing us down", "What we need to unblock it"] },
      { title: "Thank You", bullets: ["Shoutouts", "Questions?"] },
    ],
  },
  {
    id: "product-launch",
    kind: "deck",
    name: "Product Launch",
    description: "Cover, problem, product, features, roadmap.",
    slides: [
      { title: "Introducing [Product Name]", bullets: ["Launch date: [date]"] },
      { title: "The Problem", bullets: ["What customers struggle with today"] },
      { title: "The Product", bullets: ["What it is", "Who it's for"] },
      { title: "Key Features", bullets: ["Feature 1", "Feature 2", "Feature 3"] },
      { title: "What's Next", bullets: ["Roadmap highlights", "How to get access"] },
    ],
  },
  {
    id: "lesson-plan",
    kind: "deck",
    name: "Educational Lesson",
    description: "Cover, objectives, content, recap, questions.",
    slides: [
      { title: "[Lesson Title]", bullets: ["[Course / class name]"] },
      { title: "Learning Objectives", bullets: ["By the end, you'll be able to...", "Objective 2", "Objective 3"] },
      { title: "Key Concept 1", bullets: ["Explanation", "Example"] },
      { title: "Key Concept 2", bullets: ["Explanation", "Example"] },
      { title: "Recap", bullets: ["Summary of what we covered", "How it connects to next time"] },
      { title: "Questions?", bullets: ["Let's discuss"] },
    ],
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
      subheadline: "[Event Name]",
      body: ["[Date] at [Time]", "[Venue / Location]", "[Short description of what to expect]"],
      cta: "RSVP at [link or contact]",
      footer: "[Organizer name]",
    },
  },
  {
    id: "promo-flyer",
    kind: "flyer",
    name: "Promotional Flyer",
    description: "Offer headline, details, call to action.",
    content: {
      headline: "[Offer Headline]",
      subheadline: "Limited time only",
      body: ["[What the offer includes]", "[Any terms or conditions]", "[Why it matters to the customer]"],
      cta: "[Call to action, e.g. Shop now at ...]",
      footer: "[Business name / contact info]",
    },
  },
  {
    id: "announcement-flyer",
    kind: "flyer",
    name: "Announcement Flyer",
    description: "Headline, body copy, contact info.",
    content: {
      headline: "[Announcement Headline]",
      body: ["[Details of the announcement]", "[Why it matters]", "[What happens next]"],
      footer: "[Contact name / email / phone]",
    },
  },
];

export function findTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
