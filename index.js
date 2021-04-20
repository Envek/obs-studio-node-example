const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path');

const obsRecorder = require('./obsRecorder');

ipcMain.handle('recording-start', (event) => {
  obsRecorder.start();
  return { recording: true };
});

ipcMain.handle('recording-stop', (event) => {
  obsRecorder.stop();
  return { recording: false };
});

ipcMain.handle('isVirtualCamPluginInstalled', (event) => {
  return obsRecorder.isVirtualCamPluginInstalled();
});
ipcMain.handle('startVirtualCam', (event) => {
  return obsRecorder.startVirtualCam();
});
ipcMain.handle('stopVirtualCam', (event) => {
  return obsRecorder.stopVirtualCam();
});
ipcMain.handle('installVirtualCamPlugin', (event) => {
  return obsRecorder.installVirtualCamPlugin();
});
ipcMain.handle('uninstallVirtualCamPlugin', (event) => {
  return obsRecorder.uninstallVirtualCamPlugin();
});

app.on('will-quit', obsRecorder.shutdown);

function createWindow () {
  // Create the browser window.
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: true,
	  enableRemoteModule: true,
    }
  });

  ipcMain.handle('recording-init', (event) => {
    obsRecorder.initialize(win);
    return true;
  });

  ipcMain.handle('preview-init', (event, bounds) => {
    return obsRecorder.setupPreview(win, bounds);
  });

  ipcMain.handle('preview-bounds', (event, bounds) => {
    return obsRecorder.resizePreview(win, bounds);
  });

  // and load the index.html of the app.
  win.loadFile('index.html');

  // Open the DevTools.
  win.webContents.openDevTools();
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
