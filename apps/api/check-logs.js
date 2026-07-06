import { Client } from "ssh2";

const conn = new Client();

conn.on("ready", () => {
  console.log("SSH Connected. Fetching status...");
  
  conn.exec("cd /root/auto-cap-don-diin-staging/apps/web && npx vite preview --host 0.0.0.0 --port 5175 & sleep 5 && curl -i http://127.0.0.1:5175/api/health && kill $!", (err, stream) => {
    if (err) {
      console.error(err);
      conn.end();
      return;
    }
    stream.on("close", (code) => {
      console.log(`\nCommand exited with code: ${code}`);
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
