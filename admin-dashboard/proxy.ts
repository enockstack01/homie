import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// "/" is public so a signed-out visitor sees the marketing landing page (see
// app/page.tsx) instead of being bounced straight to /sign-in - a signed-in visitor
// still gets redirected from "/" to their role's home by that same page.
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
