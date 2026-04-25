#!/usr/bin/env bun
import { spawn } from "child_process";
import { writeFileSync } from "fs";

const PROJECT_DIR = "/home/z/my-project";

const child = spawn("bun", ["x", "next", "dev", "-p", "3000"], {
  cwd: PROJECT_DIR,
  detached: true,
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    NODE_OPTIONS: "--max-old-space-size=4096",
  },
});

const logStream = await import("fs").then(m => m.createWriteStream(`${PROJECT_DIR}/dev.log`, { flags: "w" }));
child.stdout.pipe(logStream);
child.stderr.pipe(logStream);

child.stdout.on("data", (data: Buffer) => {
  const str = data.toString();
  if (str.includes("Ready") || str.includes("Local:")) {
    console.log(str.trim());
  }
});

// Write PID file
writeFileSync(`${PROJECT_DIR}/.zscripts/dev.pid`, child.pid.toString());

// Fully detach - the child process will not be killed when the parent exits
child.unref();

console.log(`Next.js dev server started with PID: ${child.pid}`);
console.log("Process detached - will survive parent exit");
