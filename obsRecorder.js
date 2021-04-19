const path = require('path');
const { Subject } = require('rxjs');
const { first } = require('rxjs/operators');
const { byOS, OS, getOS } = require('./operating-systems');

const osn = require("obs-studio-node");
const { v4: uuid } = require('uuid');
const videoPath = (require("electron").app).getPath("videos");
let nwr;

// NWR is used to handle display rendering via IOSurface on mac
if (getOS() === OS.Mac) {
  nwr = require('node-window-rendering');
}

let obsInitialized = false;
let scene = null;

// When packaged, we need to fix some paths
function fixPathWhenPackaged(p) {
  return p.replace("app.asar", "app.asar.unpacked");
}

// Init the library, launch OBS Studio instance, configure it, set up sources and scene
function initialize(win) {
  if (obsInitialized) {
    console.warn("OBS is already initialized, skipping initialization.");
    return;
  }

  initOBS();
  configureOBS();
  scene = setupScene();
  setupSources(scene);
  obsInitialized = true;

  const perfStatTimer = setInterval(() => {
	  win.webContents.send("performanceStatistics", osn.NodeObs.OBS_API_getPerformanceStatistics());
  }, 1000);

  win.on('close', () => clearInterval(perfStatTimer));
}

function initOBS() {
  console.debug('Initializing OBS...');
  osn.NodeObs.IPC.host(`obs-studio-node-example-${uuid()}`);
  osn.NodeObs.SetWorkingDirectory(fixPathWhenPackaged(path.join(__dirname, 'node_modules', 'obs-studio-node')));

  const obsDataPath = fixPathWhenPackaged(path.join(__dirname, 'osn-data')); // OBS Studio configs and logs
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
  setSetting('Output', 'Mode', 'Advanced');
  const availableEncoders = getAvailableValues('Output', 'Recording', 'RecEncoder');
  setSetting('Output', 'RecEncoder', availableEncoders.slice(-1)[0] || 'x264');
  setSetting('Output', 'RecFilePath', videoPath);
  setSetting('Output', 'RecFormat', 'mkv');
  setSetting('Output', 'VBitrate', 10000); // 10 Mbps
  setSetting('Video', 'FPSCommon', 60);

  console.debug('OBS Configured');
}

function isVirtualCamPluginInstalled() {
  return osn.NodeObs.OBS_service_isVirtualCamPluginInstalled();
}

function installVirtualCamPlugin() {
  osn.NodeObs.OBS_service_installVirtualCamPlugin();
  return osn.NodeObs.OBS_service_isVirtualCamPluginInstalled();
}

function uninstallVirtualCamPlugin() {
  osn.NodeObs.OBS_service_uninstallVirtualCamPlugin();
  return !osn.NodeObs.OBS_service_isVirtualCamPluginInstalled();
}

function startVirtualCam() {
  osn.NodeObs.OBS_service_createVirtualWebcam("obs-studio-node-example-cam");
  osn.NodeObs.OBS_service_startVirtualWebcam();
}

function stopVirtualCam() {
  osn.NodeObs.OBS_service_stopVirtualWebcam();
  osn.NodeObs.OBS_service_removeVirtualWebcam();
}



// Get information about prinary display
function displayInfo() {
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const { scaleFactor } = primaryDisplay;
  return {
    width,
    height,
    scaleFactor:    scaleFactor,
    aspectRatio:    width / height,
    physicalWidth:  width * scaleFactor,
    physicalHeight: height * scaleFactor,
  }
}

function getCameraSource() {
  console.debug('Trying to set up web camera...')

  // Setup input without initializing any device just to get list of available ones
  const dummyInput = byOS({
    [OS.Windows]: () =>
      osn.InputFactory.create('dshow_input', 'video', {
        audio_device_id: 'does_not_exist',
        video_device_id: 'does_not_exist',
      }),
    [OS.Mac]: () =>
      osn.InputFactory.create('av_capture_input', 'video', {
        device: 'does_not_exist',
      })
  });

  const cameraItems = dummyInput.properties.get(byOS({ [OS.Windows]: 'video_device_id', [OS.Mac]: 'device' })).details.items;

  dummyInput.release();

  if (cameraItems.length === 0) {
    console.debug('No camera found!!')
    return null;
  }

  const deviceId = cameraItems[0].value;
  cameraItems[0].selected = true;
  console.debug('cameraItems[0].name: ' + cameraItems[0].name);

  const obsCameraInput = byOS({
    [OS.Windows]: () =>
      osn.InputFactory.create('dshow_input', 'video', {
        video_device_id: deviceId,
      }),
    [OS.Mac]: () =>
      osn.InputFactory.create('av_capture_input', 'video', {
        device: deviceId,
      }),
  })

  // It's a hack to wait a bit until device become initialized (maximum for 1 second)
  // If you know proper way how to determine whether camera is working and how to subscribe for any events from it, create a pull request
  // See discussion at https://github.com/Envek/obs-studio-node-example/issues/10
  for (let i = 1; i <= 4; i++) {
    if (obsCameraInput.width === 0) {
      const waitMs = 100 * i;
      console.debug(`Waiting for ${waitMs}ms until camera get initialized.`);
      busySleep(waitMs); // We can't use async/await here
    }
  }

  if (obsCameraInput.width === 0) {
    console.debug(`Found camera "${cameraItems[0].name}" doesn't seem to work as its reported width is still zero.`);
    return null;
  }

  // Way to update settings if needed:
  // let settings = obsCameraInput.settings;
  // console.debug('Camera settings:', obsCameraInput.settings);
  // settings['width'] = 320;
  // settings['height'] = 240;
  // obsCameraInput.update(settings);
  // obsCameraInput.save();

  return obsCameraInput;
}

function setupScene() {
  const videoSource = osn.InputFactory.create(byOS({ [OS.Windows]: 'monitor_capture', [OS.Mac]: 'display_capture' }), 'desktop-video');

  const { physicalWidth, physicalHeight, aspectRatio } = displayInfo();

  // Update source settings:
  let settings = videoSource.settings;
  settings['width'] = physicalWidth;
  settings['height'] = physicalHeight;
  videoSource.update(settings);
  videoSource.save();

  // Set output video size to 1920x1080
  const outputWidth = 1920;
  const outputHeight = Math.round(outputWidth / aspectRatio);
  setSetting('Video', 'Base', `${outputWidth}x${outputHeight}`);
  setSetting('Video', 'Output', `${outputWidth}x${outputHeight}`);
  const videoScaleFactor = physicalWidth / outputWidth;

  // A scene is necessary here to properly scale captured screen size to output video size
  const scene = osn.SceneFactory.create('test-scene');
  const sceneItem = scene.add(videoSource);
  sceneItem.scale = { x: 1.0/ videoScaleFactor, y: 1.0 / videoScaleFactor };

  // If camera is available, make it 1/3 width of video and place it to right down corner of display
  const cameraSource = getCameraSource();
  if (cameraSource) {
    const cameraItem = scene.add(cameraSource);
    const cameraScaleFactor = 1.0 / (3.0 * cameraSource.width / outputWidth);
    cameraItem.scale = { x: cameraScaleFactor, y: cameraScaleFactor };
    cameraItem.position = {
      x: outputWidth - cameraSource.width * cameraScaleFactor - outputWidth / 10,
      y: outputHeight - cameraSource.height * cameraScaleFactor - outputHeight / 10,
    };
  }

  return scene;
}

function getAudioDevices(type, subtype) {
  const dummyDevice = osn.InputFactory.create(type, subtype, { device_id: 'does_not_exist' });
  const devices = dummyDevice.properties.get('device_id').details.items.map(({ name, value }) => {
    return { device_id: value, name,};
  });
  dummyDevice.release();
  return devices;
};

function setupSources() {
  osn.Global.setOutputSource(1, scene);

  setSetting('Output', 'Track1Name', 'Mixed: all sources');
  let currentTrack = 2;

  getAudioDevices(byOS({ [OS.Windows]: 'wasapi_output_capture', [OS.Mac]: 'coreaudio_output_capture' }), 'desktop-audio').forEach(metadata => {
    if (metadata.device_id === 'default') return;
    const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_output_capture', [OS.Mac]: 'coreaudio_output_capture' }), 'desktop-audio', { device_id: metadata.device_id });
    setSetting('Output', `Track${currentTrack}Name`, metadata.name);
    source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
    osn.Global.setOutputSource(currentTrack, source);
    currentTrack++;
  });

  getAudioDevices(byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }), 'mic-audio').forEach(metadata => {
    if (metadata.device_id === 'default') return;
    const source = osn.InputFactory.create(byOS({ [OS.Windows]: 'wasapi_input_capture', [OS.Mac]: 'coreaudio_input_capture' }), 'mic-audio', { device_id: metadata.device_id });
    setSetting('Output', `Track${currentTrack}Name`, metadata.name);
    source.audioMixers = 1 | (1 << currentTrack-1); // Bit mask to output to only tracks 1 and current track
    osn.Global.setOutputSource(currentTrack, source);
    currentTrack++;
  });

  setSetting('Output', 'RecTracks', parseInt('1'.repeat(currentTrack-1), 2)); // Bit mask of used tracks: 1111 to use first four (from available six)
}

const displayId = 'display1';

function setupPreview(window, bounds) {
  osn.NodeObs.OBS_content_createSourcePreviewDisplay(
    window.getNativeWindowHandle(),
    scene.name, // or use camera source Id here
    displayId,
  );
  osn.NodeObs.OBS_content_setShouldDrawUI(displayId, false);
  osn.NodeObs.OBS_content_setPaddingSize(displayId, 0);
  // Match padding color with main window background color
  osn.NodeObs.OBS_content_setPaddingColor(displayId, 255, 255, 255);

  return resizePreview(window, bounds);
}
let existingWindow = false
let initY = 0
function resizePreview(window, bounds) {
  let { aspectRatio, scaleFactor } = displayInfo();
  if (getOS() === OS.Mac) {
    scaleFactor = 1
  }
  const displayWidth = Math.floor(bounds.width);
  const displayHeight = Math.round(displayWidth / aspectRatio);
  const displayX = Math.floor(bounds.x);
  const displayY = Math.floor(bounds.y);
  if (initY === 0) {
    initY = displayY
  }
  osn.NodeObs.OBS_content_resizeDisplay(displayId, displayWidth * scaleFactor, displayHeight * scaleFactor);

  if (getOS() === OS.Mac) {
    if (existingWindow) {
      nwr.destroyWindow(displayId);
      nwr.destroyIOSurface(displayId);
    }
    const surface = osn.NodeObs.OBS_content_createIOSurface(displayId)
    nwr.createWindow(
      displayId,
      window.getNativeWindowHandle(),
    );
    nwr.connectIOSurface(displayId, surface);
    nwr.moveWindow(displayId, displayX * scaleFactor, (initY - displayY + initY) * scaleFactor)
    existingWindow = true
  } else {
    osn.NodeObs.OBS_content_moveDisplay(displayId, displayX * scaleFactor, displayY * scaleFactor);
  }

  return { height: displayHeight }
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

function getAvailableValues(category, subcategory, parameter) {
  const categorySettings = osn.NodeObs.OBS_settings_getSettings(category).data;
  if (!categorySettings) {
    console.warn(`There is no category ${category} in OBS settings`);
    return [];
  }

  const subcategorySettings = categorySettings.find(sub => sub.nameSubCategory === subcategory);
  if (!subcategorySettings) {
    console.warn(`There is no subcategory ${subcategory} for OBS settings category ${category}`);
    return [];
  }

  const parameterSettings = subcategorySettings.parameters.find(param => param.name === parameter);
  if (!parameterSettings) {
    console.warn(`There is no parameter ${parameter} for OBS settings category ${category}.${subcategory}`);
    return [];
  }

  return parameterSettings.values.map( value => Object.values(value)[0]);
}

const signals = new Subject();

function getNextSignalInfo() {
  return new Promise((resolve, reject) => {
    signals.pipe(first()).subscribe(signalInfo => resolve(signalInfo));
    setTimeout(() => reject('Output signal timeout'), 30000);
  });
}

function busySleep(sleepDuration) {
  var now = new Date().getTime();
  while(new Date().getTime() < now + sleepDuration) { /* do nothing */ };
}

module.exports.initialize = initialize;
module.exports.start = start;
module.exports.isVirtualCamPluginInstalled = isVirtualCamPluginInstalled;
module.exports.installVirtualCamPlugin = installVirtualCamPlugin;
module.exports.uninstallVirtualCamPlugin = uninstallVirtualCamPlugin;
module.exports.startVirtualCam = startVirtualCam;
module.exports.stopVirtualCam = stopVirtualCam;
module.exports.stop = stop;
module.exports.shutdown = shutdown;
module.exports.setupPreview = setupPreview;
module.exports.resizePreview = resizePreview;
