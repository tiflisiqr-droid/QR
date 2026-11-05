import { useCallback, useEffect, useState } from "react";

const DISMISS_KEY = "tiflisi-pwa-install-dismissed";
const DISMISS_MS = 14 * 24 * 60 * 60 * 1000;

function isStandaloneDisplay() {
  try {
    if (window.matchMedia("(display-mode: standalone)").matches) return true;
    if (window.matchMedia("(display-mode: fullscreen)").matches) return true;
    if (window.navigator.standalone === true) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function isIosSafari() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua);
  const notChrome = !/CriOS|FxiOS|EdgiOS|OPiOS|Chrome|Android/i.test(ua);
  return iOS && webkit && notChrome;
}

function wasDismissedRecently() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_MS;
  } catch {
    return false;
  }
}

function markDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore */
  }
}

/**
 * Native install (Chrome/Edge/Android) + iOS Add to Home Screen hint.
 * Renders only when install is available and not already installed.
 */
export function InstallAppPrompt({ lang = "ka", labels, variant = "welcome" }) {
  const [deferred, setDeferred] = useState(null);
  const [iosHint, setIosHint] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (isStandaloneDisplay() || wasDismissedRecently()) {
      setHidden(true);
      return undefined;
    }

    if (isIosSafari()) {
      setIosHint(true);
      setHidden(false);
      return undefined;
    }

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setHidden(false);
    };
    const onInstalled = () => {
      setDeferred(null);
      setHidden(true);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = useCallback(() => {
    markDismissed();
    setShowIosSheet(false);
    setHidden(true);
  }, []);

  const onInstallClick = useCallback(async () => {
    if (iosHint) {
      setShowIosSheet(true);
      return;
    }
    if (!deferred) return;
    try {
      deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice?.outcome === "accepted") {
        setHidden(true);
      } else {
        markDismissed();
        setHidden(true);
      }
    } catch {
      setDeferred(null);
    }
  }, [deferred, iosHint]);

  if (hidden || (!deferred && !iosHint)) return null;

  const t = labels || {};
  const title = t.installApp || "Install app";
  const hint = t.installAppHint || "";
  const dismissLabel = t.installDismiss || "Not now";

  return (
    <>
      <div className={`pwa-install pwa-install--${variant}`} role="region" aria-label={title}>
        <button type="button" className="pwa-install-btn" onClick={onInstallClick}>
          <span className="pwa-install-btn__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 3v10" strokeLinecap="round" />
              <path d="M8 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" strokeLinecap="round" />
            </svg>
          </span>
          <span className="pwa-install-btn__text">
            <strong>{title}</strong>
            {hint ? <small>{hint}</small> : null}
          </span>
        </button>
        <button type="button" className="pwa-install-dismiss" onClick={dismiss} aria-label={dismissLabel}>
          {dismissLabel}
        </button>
      </div>

      {showIosSheet && (
        <div
          className="pwa-ios-sheet-backdrop"
          role="presentation"
          onClick={() => setShowIosSheet(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setShowIosSheet(false);
          }}
        >
          <div
            className="pwa-ios-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pwa-ios-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div id="pwa-ios-title" className="pwa-ios-sheet__title">
              {t.installIosTitle || title}
            </div>
            <p className="pwa-ios-sheet__body">{t.installIosBody || hint}</p>
            <ol className="pwa-ios-sheet__steps" lang={lang}>
              <li>{t.installIosStep1}</li>
              <li>{t.installIosStep2}</li>
              <li>{t.installIosStep3}</li>
            </ol>
            <button type="button" className="pwa-ios-sheet__ok" onClick={dismiss}>
              {t.installGotIt || dismissLabel}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
