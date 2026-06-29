import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  conn.exec("tail -n 40 /root/.pm2/logs/diin-worker-out.log; echo '=== ERRORS ==='; tail -n 40 /root/.pm2/logs/diin-worker-error.log", (err, stream) => {
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
