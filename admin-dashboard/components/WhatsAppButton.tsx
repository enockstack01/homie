// wa.me expects digits only (no "+", spaces, or dashes) in its click-to-chat URL.
const WHATSAPP_NUMBER = "250722439327";
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}`;

/**
 * Floating support contact button, present on every page (signed-in and signed-out alike
 * - rendered unconditionally in app/layout.tsx, unlike Footer which only shows when
 * signed out). Fixed position so it stays reachable while scrolling; sized down on small
 * viewports so it doesn't crowd content on mobile screens.
 */
export function WhatsAppButton() {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="group fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 sm:bottom-6 sm:right-6 sm:h-14 sm:w-14"
    >
      <span
        className="absolute inset-0 animate-ping rounded-full"
        style={{ backgroundColor: "#25D366", opacity: 0.4 }}
      />
      <span
        className="absolute inset-0 rounded-full"
        style={{ backgroundColor: "#25D366" }}
      />
      <svg
        viewBox="0 0 32 32"
        fill="white"
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-6 w-6 sm:h-7 sm:w-7"
        aria-hidden="true"
      >
        <path d="M16.001 3C9.373 3 4 8.373 4 15c0 2.394.628 4.643 1.723 6.6L4 29l7.6-1.688A11.94 11.94 0 0 0 16.001 27C22.629 27 28 21.627 28 15S22.629 3 16.001 3Zm0 21.818a9.77 9.77 0 0 1-4.978-1.36l-.357-.21-4.51 1.002 1.017-4.394-.232-.36A9.77 9.77 0 0 1 6.182 15c0-5.42 4.399-9.818 9.819-9.818S25.818 9.58 25.818 15 21.42 24.818 16.001 24.818Zm5.386-7.34c-.295-.148-1.746-.862-2.017-.96-.27-.098-.467-.148-.664.148-.196.295-.76.96-.933 1.157-.172.196-.344.221-.639.074-.295-.148-1.246-.459-2.373-1.463-.877-.782-1.47-1.748-1.642-2.043-.172-.295-.018-.454.13-.602.134-.133.295-.344.443-.516.148-.172.196-.295.295-.492.098-.196.049-.369-.025-.516-.074-.148-.664-1.6-.91-2.192-.24-.577-.484-.499-.664-.508l-.565-.01c-.196 0-.516.074-.786.369-.27.295-1.033 1.009-1.033 2.461 0 1.452 1.058 2.855 1.205 3.052.148.196 2.083 3.181 5.048 4.463.705.304 1.255.486 1.684.622.708.225 1.352.193 1.86.117.567-.085 1.746-.714 1.992-1.403.246-.69.246-1.28.172-1.403-.074-.123-.27-.196-.565-.344Z" />
      </svg>
      <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-md bg-black/80 px-3 py-1.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 sm:block">
        Chat with us on WhatsApp
      </span>
    </a>
  );
}
