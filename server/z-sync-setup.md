# Getting dashboard uploads onto Z:\ — setup (18 Nov 2026)

The "File upload" card on the Workspace Home dashboard saves a file to the
private cloud bucket and writes its name into the `dash_uploads` table. This
script is the last leg: it copies each new file onto the company server.

    browser  ->  Supabase Storage (private)  ->  z-sync.ps1  ->  Z:\RugsUploads\<year>\<month>\

A web page cannot write into `Z:\` by itself — browsers block all drive paths —
which is why this runs on a machine instead.

---

## 1. Put the key on the machine that will run it

The script needs the secret key. It is **not** in this repo on purpose (this
folder is pushed to GitHub). It is in:

    Desktop\Rugs upload key.txt

Copy that file to the same place on the machine that will run the script, or
instead set an environment variable called `RUGS_ZSYNC_KEY`. Nothing else is
needed — the key only lets the script fetch pending files and report back.

If the key ever leaks, say so and a new one can be generated; the old one stops
working immediately.

## 2. Try it by hand first

Open PowerShell on that machine and run:

    powershell -ExecutionPolicy Bypass -File "C:\path\to\Workspace\server\z-sync.ps1" -WhatIfOnly

`-WhatIfOnly` copies nothing — it just lists what it would copy and where. You
should see either `nothing new to copy`, or a `would copy: ... -> ...` line per
file. Then run it for real by leaving `-WhatIfOnly` off.

Every run also writes to `C:\ProgramData\RugsUpload\z-sync.log`, so you can
always see what happened.

## 3. IMPORTANT — the drive letter and Task Scheduler

A mapped drive like `Z:` belongs to **one signed-in Windows user**. A scheduled
task that runs when nobody is logged on usually cannot see `Z:` at all, and the
script will simply log "Z:\ is not available" and do nothing.

Two ways round it, pick one:

**(a) Use the real network path instead of the letter (recommended)**

    -Dest "\\fileserver\share\RugsUploads"

(replace `fileserver\share` with whatever `Z:` actually points to — in
File Explorer, right-click `Z:` and look at the path). The task then works
whether anyone is logged on or not.

**(b) Keep `Z:` and run the task only while someone is logged on**

In Task Scheduler, on the General tab choose "Run only when user is logged on".
Fine for an office PC that is always signed in; it stops when they sign out.

## 4. Create the scheduled task (every minute)

One line, in an **Administrator** PowerShell, with the paths corrected:

    schtasks /Create /TN "Rugs upload to Z" /SC MINUTE /MO 1 /F /RL LIMITED /TR "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"C:\path\to\Workspace\server\z-sync.ps1\" -Dest \"\\fileserver\share\RugsUploads\""

Useful afterwards:

    schtasks /Run    /TN "Rugs upload to Z"      (run it now)
    schtasks /Query  /TN "Rugs upload to Z" /V /FO LIST   (did it run? result 0 = fine)
    schtasks /Delete /TN "Rugs upload to Z" /F   (remove it)

Running every minute is safe: the script takes a lock, so if one run is still
downloading a big file the next minute's run exits straight away.

## 5. Check it worked

Upload a small file from the dashboard card. Within a minute or so:

* the file appears in `Z:\RugsUploads\<year>\<month>\`
* the card's "Company server" column changes from "copying…" to "✓ on Z:"
  (hover it to see the full path it was saved to)

If a file fails, the card shows "Z: failed" with the reason on hover, and the
script retries it on later runs — up to 6 tries, then it stops offering that
file so a broken one never loops for ever.

## Notes

* Files are downloaded to a `.part` file and renamed only when complete, so a
  half-copied file never looks finished on `Z:`.
* The size is checked against what the browser uploaded; a mismatch is treated
  as a failure and retried.
* A name that already exists is kept, not overwritten — the new one becomes
  `name (2).pdf`, `name (3).pdf` and so on.
* The cloud copy stays in the bucket as well. Deleting a file from the card
  removes the cloud copy; it does **not** remove the copy already on `Z:`.
