"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const { app, BrowserWindow, globalShortcut } = require('electron');
let win;
app.commandLine.appendSwitch('ignore-gpu-blacklist');
if (app.dock) {
    app.dock.hide();
}
app.on('ready', () => {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'Live Share',
        frame: false,
        show: false,
        icon: path.join(__dirname, 'LiveShare.png'),
        skipTaskbar: true,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
        }
    });
    win.setMenu(null);
    win.loadURL(`file://${__dirname}/index.html`);
    //win.minimize();
    win.hide();
    // For debugging:
    //win.show();
    //win.webContents.openDevTools();
    globalShortcut.register('CommandOrControl+Shift+K', () => {
        win.webContents.openDevTools();
    });
    win.on('closed', () => {
        win = null;
    });
});
app.on('window-all-closed', () => {
    app.quit();
});
//# sourceMappingURL=main.js.map