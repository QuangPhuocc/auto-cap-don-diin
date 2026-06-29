import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  // Query sqlite database for latest jobs and check if error screenshot file exists
  conn.exec(
    "sqlite3 /var/database/dev.db 'SELECT id, type, status, error, created_at FROM jobs ORDER BY created_at DESC LIMIT 5;'; ls -la /root/auto-cap-don-diin/apps/api/screenshot-error.png || echo 'No screenshot'",
    (err, stream) => {
      if (err) throw err;
      stream.on("close", (code, signal) => {
        conn.end();
      }).on("data", (data) => {
        process.stdout.write(data);
      }).stderr.on("data", (data) => {
        process.stderr.write(data);
      });
    }
  );
}).connect({
  host: "103.211.200.219",
  port: 22,
  username: "root",
  password: "Ku7Vrtq1ephRUXUx"
});
