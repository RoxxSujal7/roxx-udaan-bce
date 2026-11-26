import * as React from "react";

/** Returns true once the page's .loader overlay is hidden (or absent). */
export function useAfterLoader(): boolean {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const isHidden = () => {
      const loader = document.querySelector(".loader") as HTMLElement | null;
      if (!loader) return true;
      return window.getComputedStyle(loader).display === "none";
    };

    if (isHidden()) {
      setReady(true);
      return;
    }

    const loader = document.querySelector(".loader") as HTMLElement | null;
    if (!loader) {
      setReady(true);
      return;
    }

    const check = () => {
      if (isHidden()) {
        setReady(true);
        observer.disconnect();
        window.clearInterval(poll);
      }
    };

    const observer = new MutationObserver(check);
    observer.observe(loader, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    // Fallback poll in case animation finishes or display changes without attribute mutation
    const poll = window.setInterval(check, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(poll);
    };
  }, []);

  return ready;
}
