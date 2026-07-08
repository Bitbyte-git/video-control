import { useEffect, useRef, useState } from "react";
import "./App.css";

const REQUIRED_SECONDS = 10;
const DEFAULT_VIDEO_SRC = "/video.mp4";

async function requestCount(path, options) {
  const response = await fetch(path, options);

  if (!response.ok) {
    throw new Error("The view count server did not respond correctly.");
  }

  return response.json();
}

function App() {
  const videoRef = useRef(null);
  const timerRef = useRef(null);
  const lastTickRef = useRef(0);
  const objectUrlRef = useRef("");
  const watchedSecondsRef = useRef(0);
  const countedThisSessionRef = useRef(false);

  const [videoSrc, setVideoSrc] = useState(DEFAULT_VIDEO_SRC);
  const [videoName, setVideoName] = useState("public/video.mp4");
  const [viewCount, setViewCount] = useState(0);
  const [watchedSeconds, setWatchedSeconds] = useState(0);
  const [countedThisSession, setCountedThisSession] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoError, setVideoError] = useState("");
  const [countStatus, setCountStatus] = useState("Loading saved count...");

  const progressPercent = Math.min(
    100,
    (watchedSeconds / REQUIRED_SECONDS) * 100,
  );

  useEffect(() => {
    loadViewCount();

    return () => {
      stopTimer();

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
      }
    };
  }, []);

  async function loadViewCount() {
    try {
      const data = await requestCount("/api/views");
      setViewCount(data.count);
      setCountStatus("Backend count is synced.");
    } catch {
      setCountStatus("Start the backend server to sync views.");
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
    setCountedThisSession(true);

    try {
      const data = await requestCount("/api/views/increment", {
        method: "POST",
      });
      setViewCount(data.count);
      setCountStatus("View saved on backend.");
    } catch {
      countedThisSessionRef.current = false;
      setCountedThisSession(false);
      setCountStatus("Could not save view. Check the backend server.");
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
    setCountedThisSession(false);
  }

  function handlePlay() {
    setIsPlaying(true);
    startTimer();
  }

  function handlePause() {
    setIsPlaying(false);
    stopTimer();
  }

  function handleEnded() {
    setIsPlaying(false);
    stopTimer();
    resetWatchSession();
  }

  function handleRestart() {
    const video = videoRef.current;
    resetWatchSession();

    if (video) {
      video.currentTime = 0;
    }
  }

  async function handleResetCount() {
    try {
      const data = await requestCount("/api/views/reset", {
        method: "POST",
      });
      setViewCount(data.count);
      setCountStatus("Backend count reset.");
    } catch {
      setCountStatus("Could not reset count. Check the backend server.");
    }
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
    }

    objectUrlRef.current = URL.createObjectURL(file);
    setVideoSrc(objectUrlRef.current);
    setVideoName(file.name);
    setVideoError("");
    resetWatchSession();
  }

  return (
    <main className="app-shell">
      <section className="viewer-panel" aria-label="Video view counter">
        <div className="video-column">
          <div className="video-frame">
            <video
              ref={videoRef}
              key={videoSrc}
              className="video-player"
              controls
              preload="metadata"
              src={videoSrc}
              onPlay={handlePlay}
              onPause={handlePause}
              onEnded={handleEnded}
              onError={() => {
                setVideoError("Choose a video file or add one at public/video.mp4");
              }}
            />
          </div>

          {videoError ? <p className="video-error">{videoError}</p> : null}

          <div className="video-meta">
            <span>{videoName}</span>
            <label className="file-picker">
              <input type="file" accept="video/*" onChange={handleFileChange} />
              Choose video
            </label>
          </div>
        </div>

        <aside className="counter-panel" aria-label="View count">
          <div>
            <p className="eyebrow">Video Views</p>
            <h1>{viewCount}</h1>
            <p className="count-status">{countStatus}</p>
          </div>

          <div className="watch-card">
            <div className="watch-header">
              <span>{countedThisSession ? "View counted" : "Watching"}</span>
              <strong>
                {Math.floor(watchedSeconds)}s / {REQUIRED_SECONDS}s
              </strong>
            </div>
            <div
              className="progress-track"
              aria-label="Watch progress before counting a view"
              aria-valuemin="0"
              aria-valuemax={REQUIRED_SECONDS}
              aria-valuenow={Math.floor(watchedSeconds)}
              role="progressbar"
            >
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="status-row">
            <span className={isPlaying ? "status-dot active" : "status-dot"} />
            <span>{isPlaying ? "Playing" : "Paused"}</span>
          </div>

          <div className="actions">
            <button type="button" onClick={handleRestart}>
              Restart
            </button>
            <button type="button" className="danger-button" onClick={handleResetCount}>
              Reset views
            </button>
          </div>
        </aside>
      </section>
    </main>
  );
}

export default App;
