import { SUPPORT_WHATSAPP_NUMBER } from "@/lib/config";

/** Floating "chat with us" button; a plain link, so it needs no client JS. */
export function WhatsAppBubble() {
  return (
    <a
      href={`https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent("Hi, I need help with the RMJV portal.")}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      title="Chat with us on WhatsApp"
      className="fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25D366]"
    >
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="currentColor" aria-hidden>
        <path d="M16.04 3C8.84 3 3 8.83 3 16.02c0 2.3.6 4.54 1.74 6.52L3 29l6.62-1.7a13 13 0 0 0 6.42 1.64h.01C23.23 28.94 29 23.1 29 15.92 29 8.83 23.23 3 16.04 3zm0 23.7h-.01a10.8 10.8 0 0 1-5.5-1.5l-.4-.23-3.93 1.01 1.05-3.83-.26-.4a10.7 10.7 0 0 1-1.65-5.73c0-5.95 4.85-10.8 10.82-10.8 2.89 0 5.6 1.12 7.64 3.17a10.7 10.7 0 0 1 3.16 7.64c0 5.96-4.86 10.67-10.92 10.67zm5.93-8.1c-.33-.16-1.92-.95-2.22-1.05-.3-.11-.51-.16-.73.16-.22.33-.84 1.05-1.03 1.27-.19.22-.38.24-.7.08-.33-.16-1.37-.5-2.6-1.6-.96-.86-1.6-1.91-1.8-2.24-.19-.33-.02-.5.14-.66.15-.15.33-.38.49-.57.16-.19.22-.33.33-.54.11-.22.05-.4-.03-.57-.08-.16-.73-1.76-1-2.4-.26-.63-.53-.54-.73-.55h-.62c-.22 0-.57.08-.87.4-.3.33-1.14 1.11-1.14 2.7s1.17 3.14 1.33 3.36c.16.22 2.3 3.5 5.57 4.92.78.34 1.38.54 1.86.69.78.25 1.49.21 2.05.13.63-.09 1.92-.78 2.19-1.54.27-.76.27-1.4.19-1.54-.08-.14-.3-.22-.62-.38z" />
      </svg>
    </a>
  );
}
