const fs = require("fs");
const path = require("path");
const os = require("os");
const archiver = require("archiver");
const nodemailer = require("nodemailer");

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "app.db");
const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

function getSmtpConfig() {
  if (!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)) return null;
  return {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
  };
}

async function makeZip() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`No database found at ${DB_PATH} -- nothing to back up yet.`);
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const zipPath = path.join(os.tmpdir(), `tableserve-backup-${stamp}.zip`);

  await new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);

    for (const ext of ["", "-wal", "-shm"]) {
      const p = DB_PATH + ext;
      if (fs.existsSync(p)) archive.file(p, { name: "data/" + path.basename(p) });
    }

    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, "data/uploads");
    }

    archive.finalize();
  });

  return zipPath;
}

async function emailZip(zipPath) {
  const config = getSmtpConfig();
  if (!config) {
    console.error(
      "[backup] SMTP isn't configured, so the backup was created locally but could not be emailed. File is at: " + zipPath
    );
    return false;
  }

  const to = process.env.BACKUP_EMAIL || config.from;
  const transport = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.user, pass: config.pass },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 30000,
  });

  const sizeMb = (fs.statSync(zipPath).size / (1024 * 1024)).toFixed(2);

  await transport.sendMail({
    from: config.from,
    to,
    subject: `TableServe backup -- ${new Date().toISOString().slice(0, 10)}`,
    text:
      `Attached is your daily TableServe database backup (${sizeMb} MB).\n\n` +
      `Keep this somewhere safe. To restore, stop the server, replace data/app.db ` +
      `(and data/uploads) with the files from this zip, then start the server again.`,
    attachments: [{ filename: path.basename(zipPath), path: zipPath }],
  });

  console.log(`[backup] Emailed backup (${sizeMb} MB) to ${to}`);
  return true;
}

async function main() {
  try {
    const zipPath = await makeZip();
    const sent = await emailZip(zipPath);
    if (sent) {
      fs.unlinkSync(zipPath);
    } else {
      console.error(`[backup] Keeping local file since it wasn't emailed: ${zipPath}`);
    }
    console.log("[backup] Done.");
  } catch (e) {
    console.error("[backup] Failed:", e.message);
    process.exitCode = 1;
  }
}

main();
