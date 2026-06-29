import { Client } from "ssh2";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  
  const cmd = "cd /root/auto-cap-don-diin/apps/api && node -e \"import('@prisma/client').then(m => { const p = new m.PrismaClient(); p.policy.findMany({orderBy:{createdAt:'desc'},take:5,select:{id:true,customerName:true,plateNumber:true,status:true,certificateNumber:true,error:true,createdAt:true}}).then(res => console.log(JSON.stringify(res, null, 2))).finally(() => p['$disconnect']()) })\"";

  conn.exec(cmd, (err, stream) => {
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
