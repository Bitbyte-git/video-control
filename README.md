# BitByte Office Tour

Premium office tour website prepared for SRM University. The project is split for separate hosting:

- `frontend/` - React + Vite app for Vercel
- `backend/` - Node HTTP API for Render

The site plays the BitByte office tour video and counts one view after 10 seconds of real playback.

## Local Development

Install dependencies:

```bash
npm install
```

Run frontend and backend together:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

Backend runs at:

```text
http://127.0.0.1:5174/
```

## Admin

Use the `Admin` button or `BitByte admin` action on the site.

Default code:

```text
bitbyte123
```

For local development, the frontend admin code lives in:

```text
frontend/.env
```

```text
VITE_ADMIN_CODE=bitbyte123
```

When you run `npm run dev`, the backend automatically uses that same code as `ADMIN_CODE`.

For deployment, set the same value in both places:

```text
VITE_ADMIN_CODE=your-secret-code
ADMIN_CODE=your-secret-code
```

Admin can:

- View the private count
- Reset the count
- Upload or replace the office tour video

Do not import large video files inside `frontend/src`. The frontend is hosted on Vercel and should stay lightweight. Upload the final tour video through the admin panel or provide a backend `PUBLIC_VIDEO_URL`.

Local backend data is stored in:

```text
backend/data/view-count.json
backend/public/office-tour.mp4
```

## Frontend Deployment: Vercel

Create a Vercel project using:

```text
Root Directory: frontend
Build Command: npm run build
Output Directory: dist
```

Add this Vercel environment variable after your Render backend is deployed:

```text
VITE_API_BASE_URL=https://your-render-service.onrender.com
VITE_ADMIN_CODE=your-secret-code
```

## Backend Deployment: Render

Create a Render Web Service using:

```text
Root Directory: backend
Build Command: npm install
Start Command: npm start
```

Set environment variables:

```text
ADMIN_CODE=your-secret-code
CORS_ORIGIN=https://your-vercel-site.vercel.app
```

For Vercel preview URLs that change on every deploy, use a wildcard pattern:

```text
CORS_ORIGIN=https://bitbyte-tech-office-tour-*-bit-byte-techhnologies.vercel.app
```

You can also allow multiple origins with commas:

```text
CORS_ORIGIN=https://bitbyte-tech-office-tour.vercel.app,https://bitbyte-tech-office-tour-*-bit-byte-techhnologies.vercel.app
```

If the video is already hosted somewhere public, you can skip admin upload and set:

```text
PUBLIC_VIDEO_URL=https://your-public-video-url.mp4
```

Optional persistent storage variables if you attach a Render disk:

```text
STORAGE_DIR=/var/data
```

or separately:

```text
DATA_DIR=/var/data/data
VIDEO_DIR=/var/data/videos
```

Without a persistent disk, Render can run the API, but uploaded videos and counts can reset when the service restarts.

## Useful Commands

```bash
npm run build
npm run lint
npm run start
```
