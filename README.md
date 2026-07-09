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

Change it with:

```bash
ADMIN_CODE=your-secret-code npm run dev
```

Admin can:

- View the private count
- Reset the count
- Upload or replace the office tour video

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
