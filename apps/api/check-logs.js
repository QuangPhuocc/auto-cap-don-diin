import { Client } from "ssh2";

const conn = new Client();

conn.on("ready", () => {
  console.log("SSH Connected. Fetching status...");
  
  conn.exec("curl -i http://localhost:5174/api/health", (err, stream) => {
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
