const { ipcRenderer, shell } = require('electron');
const path = require('path');

function initOBS() {
  // Replace with await ipcRenderer.invoke when obs-studio-node will be ready to work on recent versions of Electron.
  // See https://github.com/stream-labs/obs-studio-node/issues/605
  const result = ipcRenderer.sendSync('recording-init');
  console.debug("initOBS result:", result);
  if (result) {
    ipcRenderer.on("performanceStatistics", (_event, data) => onPerformanceStatistics(data));
  }
}

function startRecording() {
  const result = ipcRenderer.sendSync('recording-start');
  console.debug("startRecording result:", result);
  return result;
}

function stopRecording() {
  const result = ipcRenderer.sendSync('recording-stop');
  console.debug("stopRecording result:", result);
  return result;
}

let recording = false;
let recordingStartedAt = null;
let timer = null;

function switchRecording() {
  if (recording) {
    recording = stopRecording().recording;
  } else {
    recording = startRecording().recording;
  }
  updateUI();
}

function updateUI() {
  const button = document.getElementById('rec-button');
  button.disabled = false;
  if (recording) {
    button.innerText = '⏹️ Stop recording'
    startTimer();
  } else {
    button.innerText = '⏺️ Start recording'
    stopTimer();
  }
}

function startTimer() {
  recordingStartedAt = Date.now();
  timer = setInterval(updateTimer, 100);
}

function stopTimer() {
  clearInterval(timer);
}

function updateTimer() {
  const diff = Date.now() - recordingStartedAt;
  const timerElem = document.getElementById('rec-timer');
  const decimals = `${Math.floor(diff % 1000 / 100)}`;
  const seconds  = `${Math.floor(diff % 60000 / 1000)}`.padStart(2, '0');
  const minutes  = `${Math.floor(diff % 3600000 / 60000)}`.padStart(2, '0');
  const hours    = `${Math.floor(diff / 3600000)}`.padStart(2, '0');
  timerElem.innerText = `${hours}:${minutes}:${seconds}.${decimals}`;
}

function openFolder() {
  shell.openItem(path.join(__dirname, 'videos'));
}

function onPerformanceStatistics(data) {
  document.querySelector(".performanceStatistics #cpu").innerText = `${data.CPU} %`;
  document.querySelector(".performanceStatistics #cpuMeter").value = data.CPU;
  document.querySelector(".performanceStatistics #numberDroppedFrames").innerText = data.numberDroppedFrames;
  document.querySelector(".performanceStatistics #percentageDroppedFrames").innerText = `${data.percentageDroppedFrames} %`;
  document.querySelector(".performanceStatistics #bandwidth").innerText = data.bandwidth;
  document.querySelector(".performanceStatistics #frameRate").innerText = `${Math.round(data.frameRate)} fps`;
}

try {
  initOBS();
  updateUI();
} catch (err) {
  console.log(err)
}
