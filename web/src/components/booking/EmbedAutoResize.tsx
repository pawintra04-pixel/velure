"use client";

import { useEffect } from "react";

/**
 * Renders nothing — just reports this page's height to a parent window via
 * postMessage, so a business embedding /book/* in an iframe on their own
 * site (see dashboard/share's embed snippet) can size the iframe to fit
 * instead of guessing a fixed height. A no-op when the page isn't actually
 * inside an iframe (window.self === window.top), so this costs nothing for
 * every normal, non-embedded visit.
 *
 * Uses ResizeObserver on the live body element rather than reacting to
 * route changes — Next's App Router keeps this layout mounted across
 * client-side navigations within /book/*, and the observer keeps firing as
 * each new page's content changes the body's actual height, so no separate
 * per-navigation wiring is needed.
 */
export function EmbedAutoResize() {
  useEffect(() => {
    if (typeof window === "undefined" || window.self === window.top) return;

    // See globals.css: without this, the page's own min-h-full body would
    // always report a height inflated to match whatever the iframe's
    // current height already is, a self-referential loop that never
    // actually shrinks to fit shorter pages.
    document.documentElement.classList.add("velure-embedded");

    function postHeight() {
      // body.scrollHeight, not documentElement.scrollHeight: the root
      // scrolling element's scrollHeight is defined as at least the
      // viewport height (you can never scroll to less than one viewport),
      // so it silently floors at the iframe's current height exactly like
      // the min-h-full bug above — body isn't the designated root
      // scroller, so its scrollHeight reflects actual content size.
      window.parent.postMessage({ type: "velure:resize", height: document.body.scrollHeight }, "*");
    }

    postHeight();
    const observer = new ResizeObserver(postHeight);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);

  return null;
}
