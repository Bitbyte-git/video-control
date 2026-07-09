import { useEffect, useRef, useState } from "react";
import "./App.css";
import bitByteLogo from "./assets/BB-Logo (1).png";

const REQUIRED_SECONDS = 10;
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(
  /\/$/,
  "",
);

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

function videoUrl(url) {
  if (!url) {
    return "";
  }

  if (url.startsWith("http")) {
    return url;
  }

  return `${apiUrl(url)}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
}

function App() {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const watchedSecondsRef = useRef(0);
  const countedThisSessionRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState("");
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [secretCode, setSecretCode] = useState("");
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    loadVideo();

    return () => {
      stopTimer();
    };
  }, []);

  async function loadVideo() {
    try {
      const data = await requestJson("/api/video");
      const nextVideoSrc = videoUrl(data.url);
      setVideoSrc(nextVideoSrc);
      setVideoError(
        nextVideoSrc
          ? ""
          : "Upload the final office tour video from the admin panel.",
      );
    } catch {
      setVideoSrc("");
      setVideoError(
        "Connect the frontend to the Render backend to load the office tour.",
      );
    }
  }

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
      const video = videoRef.current;

      if (!video || video.paused || video.ended || video.seeking) {
        lastTickRef.current = performance.now();
        return;
      }

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

    try {
      const data = await requestJson("/api/admin/login", {
        headers: {
          "X-Admin-Code": secretCode,
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
          "X-Admin-Code": secretCode,
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
          "X-Admin-Code": secretCode,
        },
        method: "POST",
      });
      setViewCount(data.count);
      setAdminStatus("View count reset.");
    } catch {
      setAdminStatus("Could not reset count.");
    }
  }

  async function uploadVideo(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setAdminStatus("Uploading video...");

    try {
      const data = await fetch(apiUrl("/api/video"), {
        body: file,
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          "X-Admin-Code": secretCode,
        },
        method: "POST",
      }).then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data.error || "Upload failed.");
        }

        return response.json();
      });

      setVideoError("");
      resetWatchSession();
      setVideoSrc(videoUrl(data.url));
      setAdminStatus("Video uploaded.");
    } catch {
      setAdminStatus("Could not upload video.");
    } finally {
      event.target.value = "";
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
            <video
              ref={videoRef}
              key={videoSrc}
              className="video-player"
              controls
              playsInline
              preload="metadata"
              src={videoSrc}
              onEnded={() => {
                stopTimer();
                resetWatchSession();
              }}
              onError={() => {
                setVideoError(
                  "Upload the final office tour video from the admin panel.",
                );
              }}
              onPause={stopTimer}
              onPlay={startTimer}
            />

            {videoError ? <p className="video-message">{videoError}</p> : null}
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
                  <label className="upload-button">
                    <input
                      type="file"
                      accept="video/*"
                      onChange={uploadVideo}
                    />
                    Upload video
                  </label>
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
