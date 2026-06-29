import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  // Query pm2 status and detailed tail of error logs
  conn.exec("echo '=== PM2 STATUS ==='; pm2 status; echo '=== ERROR LOG DETAILS ==='; tail -n 50 /root/.pm2/logs/diin-worker-error.log", (err, stream) => {
    if (err) throw err;
    stream.on("close", (code, signal) => {
      conn.end();
    }).on("data", (data) => {
      process.stdout.write(data);
    }).stderr.on("data", (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: "103.211.200.219",
  port: 22,
  username: "root",
  password: "Ku7Vrtq1ephRUXUx"
});
