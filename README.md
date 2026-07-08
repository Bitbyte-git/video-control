# Video View Counter

Lightweight React + Node app for showing one fullscreen video and counting a view after 10 seconds of real playback.

## Development

Start the app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173/
```

## Admin

Click the `BitByte` button and enter the admin code.

Default code:

```text
bitbyte123
```

To change it:

```bash
ADMIN_CODE=your-secret-code npm run dev
```

Admin can:

- View count
- Reset count
- Upload/replace the video

Uploaded video is saved as:

```text
public/video.mp4
```

The view count is saved as:

```text
data/view-count.json
```

## Production

Build the frontend:

```bash
npm run build
```

Start the Node server:

```bash
npm start
```

Open:

```text
http://127.0.0.1:5174/
```
