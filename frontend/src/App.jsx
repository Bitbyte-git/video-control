import { useEffect, useRef, useState } from "react";
import "./App.css";
import bitByteLogo from "./assets/BB-Logo (1).png";

const REQUIRED_SECONDS = 10;
const YOUTUBE_VIDEO_ID = "JBmt4mxvbck";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);
const FRONTEND_ADMIN_CODE = (import.meta.env.VITE_ADMIN_CODE || "").trim();
let youtubeApiPromise;

async function requestJson(path, options) {
  const response = await fetch(apiUrl(path), options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function adminCodeFromInput(inputCode) {
  return FRONTEND_ADMIN_CODE || inputCode.trim();
}

function loadYouTubeApi() {
  if (globalThis.YT?.Player) {
    return Promise.resolve(globalThis.YT);
  }

  if (!youtubeApiPromise) {
    youtubeApiPromise = new Promise((resolve) => {
      const previousReady = globalThis.onYouTubeIframeAPIReady;

      globalThis.onYouTubeIframeAPIReady = () => {
        if (typeof previousReady === "function") {
          previousReady();
        }

        resolve(globalThis.YT);
      };

      if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        document.head.append(script);
      }
    });
  }

  return youtubeApiPromise;
}

function App() {
  const youtubeMountRef = useRef(null);
  const youtubePlayerRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const watchedSecondsRef = useRef(0);
  const countedThisSessionRef = useRef(false);

  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [secretCode, setSecretCode] = useState("");
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");

  useEffect(() => {
    function blockEvent(event) {
      event.preventDefault();
      event.stopPropagation();
    }

    function blockRestrictedKeys(event) {
      const key = event.key.toLowerCase();
      const hasControlKey = event.ctrlKey || event.metaKey;
      const isFunctionDevTools = event.key === "F12";
      const isDevToolsCombo =
        hasControlKey && event.shiftKey && ["c", "i", "j"].includes(key);
      const isMacDevToolsCombo =
        event.metaKey && event.altKey && ["c", "i", "j"].includes(key);
      const isBlockedShortcut =
        hasControlKey && ["c", "p", "s", "u"].includes(key);

      if (
        isFunctionDevTools ||
        isDevToolsCombo ||
        isMacDevToolsCombo ||
        isBlockedShortcut
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("contextmenu", blockEvent);
    document.addEventListener("copy", blockEvent);
    document.addEventListener("cut", blockEvent);
    document.addEventListener("dragstart", blockEvent);
    document.addEventListener("keydown", blockRestrictedKeys, true);

    return () => {
      document.removeEventListener("contextmenu", blockEvent);
      document.removeEventListener("copy", blockEvent);
      document.removeEventListener("cut", blockEvent);
      document.removeEventListener("dragstart", blockEvent);
      document.removeEventListener("keydown", blockRestrictedKeys, true);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    loadYouTubeApi().then((youTube) => {
      if (!isMounted || !youtubeMountRef.current) {
        return;
      }

      youtubePlayerRef.current = new youTube.Player(youtubeMountRef.current, {
        events: {
          onStateChange: (event) => {
            if (event.data === youTube.PlayerState.PLAYING) {
              startTimer();
              return;
            }

            stopTimer();

            if (event.data === youTube.PlayerState.ENDED) {
              resetWatchSession();
            }
          },
        },
        playerVars: {
          modestbranding: 1,
          playsinline: 1,
          rel: 0,
        },
        videoId: YOUTUBE_VIDEO_ID,
      });
    });

    return () => {
      isMounted = false;
      stopTimer();

      if (youtubePlayerRef.current?.destroy) {
        youtubePlayerRef.current.destroy();
      }
    };
  }, []);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  async function countViewOnce() {
    if (countedThisSessionRef.current) {
      return;
    }

    countedThisSessionRef.current = true;

    try {
      await requestJson("/api/views/increment", {
        method: "POST",
      });
    } catch {
      countedThisSessionRef.current = false;
    }
  }

  function startTimer() {
    stopTimer();
    lastTickRef.current = performance.now();

    timerRef.current = setInterval(() => {
      const now = performance.now();
      const elapsedSeconds = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;
      watchedSecondsRef.current = Math.min(
        REQUIRED_SECONDS,
        watchedSecondsRef.current + elapsedSeconds,
      );
      setWatchedSeconds(watchedSecondsRef.current);

      if (watchedSecondsRef.current >= REQUIRED_SECONDS) {
        countViewOnce();
      }
    }, 250);
  }

  function resetWatchSession() {
    watchedSecondsRef.current = 0;
    countedThisSessionRef.current = false;
    setWatchedSeconds(0);
  }

  async function unlockAdmin(event) {
    event.preventDefault();
    setAdminStatus("Checking code...");

    const enteredCode = secretCode.trim();
    const adminCode = adminCodeFromInput(enteredCode);

    if (FRONTEND_ADMIN_CODE && enteredCode !== FRONTEND_ADMIN_CODE) {
      setIsAdminUnlocked(false);
      setAdminStatus("Wrong secret code.");
      return;
    }

    try {
      const data = await requestJson("/api/admin/login", {
        headers: {
          "X-Admin-Code": adminCode,
        },
        method: "POST",
      });
      setViewCount(data.count);
      setIsAdminUnlocked(true);
      setAdminStatus("Admin unlocked.");
    } catch {
      setIsAdminUnlocked(false);
      setAdminStatus("Wrong secret code.");
    }
  }

  async function refreshViewCount() {
    setAdminStatus("Loading count...");

    try {
      const data = await requestJson("/api/views", {
        headers: {
          "X-Admin-Code": adminCodeFromInput(secretCode),
        },
      });
      setViewCount(data.count);
      setAdminStatus("Count updated.");
    } catch {
      setAdminStatus("Could not load count.");
    }
  }

  async function resetViewCount() {
    setAdminStatus("Resetting count...");

    try {
      const data = await requestJson("/api/views/reset", {
        headers: {
          "X-Admin-Code": adminCodeFromInput(secretCode),
        },
        method: "POST",
      });
      setViewCount(data.count);
      setAdminStatus("View count reset.");
    } catch {
      setAdminStatus("Could not reset count.");
    }
  }

  function closeAdmin() {
    setIsAdminOpen(false);
    setIsAdminUnlocked(false);
    setSecretCode("");
    setAdminStatus("");
  }

  const watchProgress = Math.min(
    100,
    (watchedSeconds / REQUIRED_SECONDS) * 100,
  );

  return (
    <main className="app-shell">
      <header className="site-header">
        <a
          className="brand-lockup"
          href="#tour"
          aria-label="BitByte office tour"
        >
          <span className="brand-mark">
            <img src={bitByteLogo} alt="" />
          </span>
          <span>
            <strong>BitByte</strong>
            <small>Office Tour</small>
          </span>
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          <a href="#tour">Tour</a>
          <a href="#experience">Experience</a>
          <a href="#spaces">Spaces</a>
          <a href="#admin">Admin</a>
        </nav>
      </header>

      <section className="hero-section" id="tour">
        <div className="hero-copy">
          <p className="eyebrow">BitByte Office Tour</p>
          <h1>A professional look inside our workspace.</h1>
          <p className="hero-text">
            A polished tour experience built to present the BitByte environment
            with clarity, confidence, and the professional standard expected by
            a top university.
          </p>
          <div className="hero-actions">
            <a className="primary-link" href="#experience">
              Watch the tour
            </a>
            <button
              type="button"
              className="secondary-link"
              onClick={() => {
                setIsAdminOpen(true);
              }}
            >
              BitByte admin
            </button>
          </div>
        </div>

        <div className="hero-proof" aria-label="BitByte tour highlights">
          <div>
            <strong>01</strong>
            <span>Office culture</span>
          </div>
          <div>
            <strong>02</strong>
            <span>Team workflow</span>
          </div>
          <div>
            <strong>03</strong>
            <span>Professional setup</span>
          </div>
        </div>
      </section>

      <section className="experience-section" id="experience">
        <div className="section-heading">
          <p className="eyebrow">Tour presentation</p>
          <h2>Play the BitByte office tour.</h2>
          <p>
            A focused visual walkthrough of the environment, workflow, and
            professional culture inside the BitByte office.
          </p>
        </div>

        <div className="presentation-layout">
          <div className="video-frame">
            <div ref={youtubeMountRef} className="youtube-player" />
          </div>

          <aside className="tour-console" aria-label="Tour view tracking">
            <div className="console-header">
              <span>View tracking</span>
              <strong>{Math.floor(watchedSeconds)}s</strong>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${watchProgress}%` }} />
            </div>
            <dl>
              <div>
                <dt>Valid view after</dt>
                <dd>{REQUIRED_SECONDS}s</dd>
              </div>
              <div>
                <dt>Admin count</dt>
                <dd>{isAdminUnlocked ? viewCount : "Locked"}</dd>
              </div>
              <div>
                <dt>Presentation mode</dt>
                <dd>Ready</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>

      <section
        className="spaces-section"
        id="spaces"
        aria-label="BitByte workspace highlights"
      >
        <div className="section-heading">
          <p className="eyebrow">Work environment</p>
          <h2>Built around focused execution and clean collaboration.</h2>
          <p>
            A concise showcase of the office atmosphere, team rhythm, and
            presentation readiness behind BitByte.
          </p>
        </div>
        <div className="space-grid">
          <article>
            <span>01</span>
            <h3>Focused execution</h3>
            <p>
              Quiet working areas for coding, research, design reviews, and
              delivery.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>Collaborative reviews</h3>
            <p>
              Structured discussion spaces for mentoring, planning, and fast
              decisions.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>Showcase ready</h3>
            <p>
              A composed environment shaped for demos, evaluations, and
              university visits.
            </p>
          </article>
        </div>
      </section>

      <button
        type="button"
        className="floating-admin"
        id="admin"
        onClick={() => {
          setIsAdminOpen(true);
        }}
      >
        Admin
      </button>

      {isAdminOpen ? (
        <div className="admin-backdrop">
          <section className="admin-panel" aria-label="BitByte admin panel">
            <div className="admin-header">
              <h1>BitByte</h1>
              <button
                type="button"
                className="close-button"
                onClick={closeAdmin}
              >
                Close
              </button>
            </div>

            {!isAdminUnlocked ? (
              <form className="secret-form" onSubmit={unlockAdmin}>
                <label htmlFor="secretCode">Secret code</label>
                <input
                  id="secretCode"
                  autoFocus
                  type="password"
                  value={secretCode}
                  onChange={(event) => {
                    setSecretCode(event.target.value);
                  }}
                />
                <button type="submit">Unlock</button>
              </form>
            ) : (
              <div className="admin-tools">
                <div className="count-block">
                  <span>Video views</span>
                  <strong>{viewCount}</strong>
                </div>

                <div className="admin-actions">
                  <button type="button" onClick={refreshViewCount}>
                    Refresh count
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={resetViewCount}
                  >
                    Reset count
                  </button>
                </div>
              </div>
            )}

            {adminStatus ? <p className="admin-status">{adminStatus}</p> : null}
            <p className="watch-note">
              Watched {Math.floor(watchedSeconds)}s / {REQUIRED_SECONDS}s
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default App;
