Media is hosted on Cloudflare R2, not in this repo — the public GitHub
Pages repo must never contain the real photos/videos.

Upload files with `rclone` to the `layal-media` bucket, mirroring the year
folder layout below (matches the `YEARS` config in `../index.html`):

```
rclone copy /path/to/local/media/ r2:layal-media/ --progress
```

Naming convention per year folder:

- `1.jpg`, `2.jpg`, `3.jpg` — photos
- `1.mp4` — video

`index.html` builds the URL as `MEDIA_BASE_URL + year + "/" + file` (e.g.
`https://pub-5e334b9c81f0454e945b257e25c6cca1.r2.dev/2012/1.jpg`). Add more
files by extending the `photos`/`videos` arrays in the `YEARS` config and
uploading matching files to the bucket at that path.

If a file is missing from the bucket it just renders a placeholder box
naming the expected path — no broken image/error shown.
