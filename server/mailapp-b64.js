// Decode / re-encode the Rugs Email app. Since 28 Nov 2026 it is its own file, mail-app.html (no longer inside index.html).
//   node server/mailapp-b64.js decode   -> copies mail-app.html to .tmp/email.html (patch scripts edit that copy)
//   node server/mailapp-b64.js encode   -> copies .tmp/email.html back to mail-app.html (what mail.html opens)
// The old name is kept so every patch script and habit still works.
const fs = require("fs");
const APP = ".tmp/email.html", OUT = "mail-app.html";
if (process.argv[2] === "decode") {
  fs.mkdirSync(".tmp", { recursive: true });
  fs.copyFileSync(OUT, APP);
  console.log("copied", OUT, "->", APP);
} else if (process.argv[2] === "encode") {
  const h = fs.readFileSync(APP, "utf8");
  fs.writeFileSync(OUT, h);
  console.log("wrote " + OUT + " (" + h.length + " chars) from " + APP + "; index.html is not touched");
} else console.log("usage: node server/mailapp-b64.js decode|encode");
