import { Client } from "ssh2";
import fs from "fs";

const conn = new Client();
conn.on("ready", () => {
  console.log("SSH Ready!");
  
  conn.sftp((err, sftp) => {
    if (err) throw err;
    
    const remotePath = "/root/auto-cap-don-diin/apps/api/screenshot-error.png";
    const localPath = "C:/Users/Windows 11/.gemini/antigravity-ide/brain/b1f275dd-e698-4dd6-9e67-c6c8993d0c17/screenshot-error.png";
    
    console.log("Downloading screenshot from VPS...");
    sftp.fastGet(remotePath, localPath, {}, (downloadErr) => {
      if (downloadErr) {
        console.error("Error downloading file:", downloadErr);
      } else {
        console.log("Screenshot downloaded successfully to:", localPath);
      }
      conn.end();
    });
  });
}).connect({
  host: "103.211.200.219",
  port: 22,
  username: "root",
  password: "Ku7Vrtq1ephRUXUx"
});
