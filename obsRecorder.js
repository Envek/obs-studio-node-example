const path = require('path');
const { Subject } = require('rxjs');
const { first } = require('rxjs/operators');

const osn = require("obs-studio-node");

let obsInitialized = false;

// Init the library, launch OBS Studio instance, configure it, set up sources and scene
function initialize() {
  if (obsInitialized) {
    console.warn("OBS is already initialized, skipping initialization.");
    return
  }

  initOBS();
  configureOBS();
  setupSources();
  obsInitialized = true;
}

function initOBS() {
  console.debug('Initializing OBS...');
  osn.NodeObs.IPC.host('obs-studio-node-example'); // Usually some UUIDs go there
  osn.NodeObs.SetWorkingDirectory(path.join(__dirname, 'node_modules', 'obs-studio-node'));

  const obsDataPath = path.join(__dirname, 'osn-data'); // OBS Studio configs and logs
  // Arguments: locale, path to directory where configuration and logs will be stored, your application version
  const initResult = osn.NodeObs.OBS_API_initAPI('en-US', obsDataPath, '1.0.0');

  if (initResult !== 0) {
    const errorReasons = {
      '-2': 'DirectX could not be found on your system. Please install the latest version of DirectX for your machine here <https://www.microsoft.com/en-us/download/details.aspx?id=35?> and try again.',
      '-5': 'Failed to initialize OBS. Your video drivers may be out of date, or Streamlabs OBS may not be supported on your system.',
    }

    const errorMessage = errorReasons[initResult.toString()] || `An unknown error #${initResult} was encountered while initializing OBS.`;

    console.error('OBS init failure', errorMessage);

    shutdown();

    throw Error(errorMessage);
  }

  osn.NodeObs.OBS_service_connectOutputSignals((signalInfo) => {
    signals.next(signalInfo);
  });

  console.debug('OBS initialized');
}

function configureOBS() { 
  console.debug('Configuring OBS');
  setSetting('Output', 'Mode', 'Simple');
  setSetting('Output', 'RecEncoder', 'nvenc'); // You can get available encoders from OBS itself at the same key
  setSetting('Output', 'FilePath', path.join(__dirname, 'videos'));
  setSetting('Output', 'RecFormat', 'mkv')
  setSetting('Output', 'VBitrate', 10000) // 10 Mbps
  setSetting('Video', 'FPSCommon', 60)

  console.debug('OBS Configured');
}

function setupSources() {
  const videoSource = osn.InputFactory.create('monitor_capture', 'desktop-video')
  const audioSource = osn.InputFactory.create('wasapi_output_capture', 'desktop-audio')
  const micSource = osn.InputFactory.create('wasapi_input_capture', 'mic-audio')

  // Get information about prinary display
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const realDisplayWidth = primaryDisplay.size.width * primaryDisplay.scaleFactor;
  const realDisplayHeight = primaryDisplay.size.height * primaryDisplay.scaleFactor;
  const aspectRatio = realDisplayWidth / realDisplayHeight;

  // Update source settings:
  let settings = videoSource.settings;
  settings['width'] = realDisplayWidth;
  settings['height'] = realDisplayHeight;
  videoSource.update(settings);
  videoSource.save();

  // Set output video size to 1920x1080
  const outputWidth = 1920;
  setSetting('Video', 'OutputCX', outputWidth)
  setSetting('Video', 'OutputCY', Math.round(outputWidth / aspectRatio))
  const videoScaleFactor = realDisplayWidth / outputWidth;

  // A scene is necessary here to properly scale captured screen size to output video size
  const scene = osn.SceneFactory.create('test-scene');
  const sceneItem = scene.add(videoSource)
  sceneItem.scale = { x: 1.0/ videoScaleFactor, y: 1.0 / videoScaleFactor }

  // Tell recorder to use this source (I'm not sure if this is the correct way to use the first argument `channel`)
  osn.Global.setOutputSource(1, scene)
  osn.Global.setOutputSource(2, audioSource)
  osn.Global.setOutputSource(3, micSource)
}

async function start() {
  if (!obsInitialized) initialize();

  let signalInfo;

  console.debug('Starting recording...');
  osn.NodeObs.OBS_service_startRecording();

  console.debug('Started?');
  signalInfo = await getNextSignalInfo();

  if (signalInfo.signal === 'Stop') {
    throw Error(signalInfo.error);
  }

  console.debug('Started signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('Started signalInfo.signal:', signalInfo.signal, '(expected: "start")');
  console.debug('Started!');
}

async function stop() {
  let signalInfo;

  console.debug('Stopping recording...');
  osn.NodeObs.OBS_service_stopRecording();
  console.debug('Stopped?');

  signalInfo = await getNextSignalInfo();

  console.debug('On stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('On stop signalInfo.signal:', signalInfo.signal, '(expected: "stopping")');

  signalInfo = await getNextSignalInfo();

  console.debug('After stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
  console.debug('After stop signalInfo.signal:', signalInfo.signal, '(expected: "stop")');

  console.debug('Stopped!');
}

function shutdown() {
  if (!obsInitialized) {
    console.debug('OBS is already shut down!');
    return false;
  }

  console.debug('Shutting down OBS...');

  try {
    osn.NodeObs.OBS_service_removeCallback();
    osn.NodeObs.IPC.disconnect();
    obsInitialized = false;
  } catch(e) {
    throw Error('Exception when shutting down OBS process' + e);
  }

  console.debug('OBS shutdown successfully');

  return true;
}

function setSetting(category, parameter, value) {
  let oldValue;

  // Getting settings container
  const settings = osn.NodeObs.OBS_settings_getSettings(category).data;

  settings.forEach(subCategory => {
    subCategory.parameters.forEach(param => {
      if (param.name === parameter) {
        oldValue = param.currentValue;
        param.currentValue = value;
      }
    });
  });

  // Saving updated settings container
  if (value != oldValue) {
    osn.NodeObs.OBS_settings_saveSettings(category, settings);
  }
}
  
const signals = new Subject();
  
function getNextSignalInfo() {
  return new Promise((resolve, reject) => {
    signals.pipe(first()).subscribe(signalInfo => resolve(signalInfo));
    setTimeout(() => reject('Output signal timeout'), 30000);
  });
}

module.exports.initialize = initialize;
module.exports.start = start;
module.exports.stop = stop;
module.exports.shutdown = shutdown;
