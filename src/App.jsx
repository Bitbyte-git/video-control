import { useEffect, useRef, useState } from "react";
import "./App.css";

const REQUIRED_SECONDS = 10;
const DEFAULT_VIDEO_SRC = "/video.mp4";

async function requestJson(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

function App() {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const watchedSecondsRef = useRef(0);
  const countedThisSessionRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState(`${DEFAULT_VIDEO_SRC}?v=${Date.now()}`);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [viewCount, setViewCount] = useState(0);
  const [secretCode, setSecretCode] = useState("");
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminStatus, setAdminStatus] = useState("");
  const [videoError, setVideoError] = useState("");

  useEffect(() => {
    return () => {
      stopTimer();
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
      await fetch("/api/video", {
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
      });

      setVideoError("");
      resetWatchSession();
      setVideoSrc(`${DEFAULT_VIDEO_SRC}?v=${Date.now()}`);
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

  return (
    <main className="app-shell">
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
          setVideoError("Admin needs to upload a video first.");
        }}
        onPause={stopTimer}
        onPlay={startTimer}
      />

      {videoError ? <p className="video-message">{videoError}</p> : null}

      <button
        type="button"
        className="bitbyte-button"
        onClick={() => {
          setIsAdminOpen(true);
        }}
      >
        BitByte
      </button>

      {isAdminOpen ? (
        <div className="admin-backdrop">
          <section className="admin-panel" aria-label="BitByte admin panel">
            <div className="admin-header">
              <h1>BitByte</h1>
              <button type="button" className="close-button" onClick={closeAdmin}>
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
                  <button type="button" className="danger-button" onClick={resetViewCount}>
                    Reset count
                  </button>
                  <label className="upload-button">
                    <input type="file" accept="video/*" onChange={uploadVideo} />
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
