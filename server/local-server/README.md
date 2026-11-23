# Rugs Email local server — the files the office server updates itself from

The server behind `https://mail-api.rugserp.com` runs these files. Since
23 Nov 2026 it **updates itself**: every 10 minutes (and 20 seconds after it
starts) it reads `version.txt` here, and if the version has changed it
downloads each file below, keeps the old one as `.bak`, swaps the new one in
and restarts. Nobody copies anything by hand any more.

**To ship a change:** edit the file here, put a new value in `version.txt`,
and let the usual auto-push send it to GitHub. The server picks it up within
ten minutes.

A download is refused (and nothing is changed) if a file comes back shorter
than 2 KB or looks like an HTML error page, so a GitHub outage cannot break
the server.

Switches, all set in the server's own `.env`:

| setting | meaning |
|---|---|
| `UPDATE_OFF=1` | turn self-updating off completely |
| `UPDATE_EVERY=10` | minutes between checks |
| `UPDATE_BASE=…` | where to fetch from, if it ever moves |

**No secrets are here.** Everything sensitive — the database address, the
Gmail key, the Gemini key — is read from `.env` on the server and is never
part of these files. That was checked before publishing them.
