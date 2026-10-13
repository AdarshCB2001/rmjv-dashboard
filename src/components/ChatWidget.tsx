"use client";

import Script from "next/script";
import { useEffect } from "react";
import {
  CHAT_PROVIDER,
  CRISP_WEBSITE_ID,
  TAWK_PROPERTY_ID,
  TAWK_WIDGET_ID,
} from "@/lib/config";

type CrispCommand = [string, string, unknown?];
declare global {
  interface Window {
    $crisp?: CrispCommand[];
    CRISP_WEBSITE_ID?: string;
    Tawk_API?: {
      setAttributes?: (attrs: Record<string, string>, cb?: (err?: unknown) => void) => void;
      onLoad?: () => void;
    };
    Tawk_LoadStart?: Date;
  }
}

/**
 * Embeds Crisp or Tawk.to, whichever is configured, and tells it who the user is.
 *
 * Setting the identity is what makes conversation history persist per staff member
 * across sessions and devices — without it every visit looks like a new stranger in
 * the FunKustoms inbox. Renders nothing when neither provider is configured.
 */
export function ChatWidget({ email, fullName }: { email: string; fullName: string | null }) {
  useEffect(() => {
    if (CHAT_PROVIDER === "crisp") {
      window.$crisp = window.$crisp ?? [];
      window.$crisp.push(["set", "user:email", [email]]);
      if (fullName) window.$crisp.push(["set", "user:nickname", [fullName]]);
      // Tag the session so RMJV chats are filterable in the shared inbox.
      window.$crisp.push(["set", "session:segments", [["rmjv-portal"]]]);
      return;
    }

    if (CHAT_PROVIDER === "tawk") {
      const apply = () => {
        window.Tawk_API?.setAttributes?.(
          { name: fullName ?? email, email, hash: "" },
          () => {},
        );
      };
      // The widget may not have booted yet; setAttributes only exists after load.
      if (window.Tawk_API?.setAttributes) apply();
      else if (window.Tawk_API) window.Tawk_API.onLoad = apply;
    }
  }, [email, fullName]);

  if (CHAT_PROVIDER === "crisp") {
    return (
      <Script id="crisp-widget" strategy="afterInteractive">
        {`window.$crisp=window.$crisp||[];window.CRISP_WEBSITE_ID="${CRISP_WEBSITE_ID}";
          (function(){var d=document,s=d.createElement("script");
          s.src="https://client.crisp.chat/l.js";s.async=1;
          d.getElementsByTagName("head")[0].appendChild(s);})();`}
      </Script>
    );
  }

  if (CHAT_PROVIDER === "tawk") {
    return (
      <Script
        id="tawk-widget"
        strategy="afterInteractive"
        src={`https://embed.tawk.to/${TAWK_PROPERTY_ID}/${TAWK_WIDGET_ID}`}
        crossOrigin="anonymous"
      />
    );
  }

  return null;
}
