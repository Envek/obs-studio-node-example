const { ipcRenderer } = require('electron');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initOBS() {
  // Replace with await ipcRenderer.invoke when obs-studio-node will be ready to work on recent versions of Electron.
  // See https://github.com/stream-labs/obs-studio-node/issues/605
  const result = ipcRenderer.sendSync('recording-init');
  console.debug("initOBS result:", result);
}

function startRecording() {
  const result = ipcRenderer.sendSync('recording-start');
  console.debug("startRecording result:", result);
}

function stopRecording() {
  const result = ipcRenderer.sendSync('recording-stop');
  console.debug("stopRecording result:", result);
}

try {
  (async () => {
    initOBS();
    startRecording();
    await sleep(3000);
    stopRecording();
  })();
} catch (err) {
  console.log(err)
}
