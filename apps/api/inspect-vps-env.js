import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  conn.exec("cat /root/auto-cap-don-diin/apps/api/.env", (err, stream) => {
    if (err) throw err;
    stream.on("close", (code, signal) => {
      conn.end();
    }).on("data", (data) => {
      // Print env variables but hide the password value for security
      const lines = data.toString().split("\n");
      for (const line of lines) {
        if (line.includes("PASSWORD")) {
          const parts = line.split("=");
          console.log(`${parts[0]}=******`);
        } else {
          console.log(line);
        }
      }
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
