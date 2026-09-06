const { app, BrowserWindow } = require("electron");
const path = require("node:path");
const http = require("node:http");
const { spawn } = require("node:child_process");

const PORT = 8080;
const ROOT = path.join(__dirname, "..");

let serverProcess = null;

function waitForServer(url, onReady) {
  const attempt = () => {
    http
      .get(url, (res) => {
        res.resume();
        onReady();
      })
      .on("error", () => setTimeout(attempt, 300));
  };
  attempt();
}

function startServer() {
  const viteCli = path.join(ROOT, "node_modules", "vite", "bin", "vite.js");
  serverProcess = spawn(process.execPath, [viteCli, "dev", "--host", "127.0.0.1", "--port", String(PORT)], {
    cwd: ROOT,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      VITE_AUTH_ENABLED: "false",
    },
    stdio: "ignore",
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: "#0b0908",
    title: "Ember",
    autoHideMenuBar: true,
  });
  waitForServer(`http://127.0.0.1:${PORT}/`, () => {
    win.loadURL(`http://127.0.0.1:${PORT}/`);
  });
}

app.whenReady().then(() => {
  startServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (serverProcess) serverProcess.kill();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (serverProcess) serverProcess.kill();
});
