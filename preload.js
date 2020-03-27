const path = require('path');
const { Subject } = require('rxjs');
const { first } = require('rxjs/operators');
const { remote } = require('electron');

const osn = require("obs-studio-node");

const EOBSInputTypes = {
    AudioLine: 'audio_line',
    ImageSource: 'image_source',
    ColorSource: 'color_source',
    Slideshow: 'slideshow',
    BrowserSource: 'browser_source',
    FFMPEGSource: 'ffmpeg_source',
    TextGDI: 'text_gdiplus',
    TextFT2: 'text_ft2_source',
    VLCSource: 'vlc_source',
    MonitorCapture: 'monitor_capture',
    WindowCapture: 'window_capture',
    GameCapture: 'game_capture',
    DShowInput: 'dshow_input',
    WASAPIInput: 'wasapi_input_capture',
    WASAPIOutput: 'wasapi_output_capture'
}

function setSetting(category, parameter, value) {
    let oldValue;

    // Getting settings container
    const settings = osn.NodeObs.OBS_settings_getSettings(category).data;
    console.log(settings)

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

// Init the library
function init() {
  console.log('Initializing OBS...');
  osn.NodeObs.IPC.host('eletest-pipe'); // Usually some UUIDs go there
  osn.NodeObs.SetWorkingDirectory(path.join(__dirname, 'node_modules', 'obs-studio-node'));
  const obsDataPath = path.join(__dirname, 'osn-data'); // OBS Studio configs and logs
  const initResult = osn.NodeObs.OBS_API_initAPI('en-US', obsDataPath, "1.1.4");

  console.log('OBS Init result: ', initResult); // Should be 0 (Success)

  osn.NodeObs.OBS_service_connectOutputSignals((signalInfo) => {
    signals.next(signalInfo);
  });

  console.log('Configuring OBS');
  setSetting('Output', 'Mode', 'Simple');
  setSetting('Output', 'StreamEncoder', 'nvenc');
  setSetting('Output', 'FilePath', path.join(__dirname, 'videos'));
  setSetting('Output', 'RecFormat', 'mkv')
  setSetting('Output', 'VBitrate', 10000) // 10 Mbps
  setSetting('Video', 'FPSCommon', 60)

  console.log('OBS Initialized');
}

function getNextSignalInfo() {
    return new Promise((resolve, reject) => {
        signals.pipe(first()).subscribe(signalInfo => resolve(signalInfo));
        setTimeout(() => reject('Output signal timeout'), 30000);
    });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createSource() {
    const videoSource = osn.InputFactory.create(EOBSInputTypes.MonitorCapture, 'desktop-video')
    const audioSource = osn.InputFactory.create(EOBSInputTypes.WASAPIOutput, 'desktop-audio')
    const micSource = osn.InputFactory.create(EOBSInputTypes.WASAPIInput, 'mic-audio')

    // Get information about prinary display
    const primaryDisplay = remote.screen.getPrimaryDisplay();
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

async function record() {
    // Start recording
    let signalInfo;

    console.log('Starting recording...');
    osn.NodeObs.OBS_service_startRecording();

    console.log('Started?');
    signalInfo = await getNextSignalInfo();

    if (signalInfo.signal === 'Stop') {
      throw Error(signalInfo.error);
    }

    console.log('Started signalInfo.type:', signalInfo.type, '(expected: "recording")');
    console.log('Started signalInfo.signal:', signalInfo.signal, '(expected: "start")');

    // Recording...
    await sleep(30000);

    // Stopping...
    osn.NodeObs.OBS_service_stopRecording();

    signalInfo = await getNextSignalInfo();

    console.log('On stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
    console.log('On stop signalInfo.signal:', signalInfo.signal, '(expected: "stopping")');

    signalInfo = await getNextSignalInfo();

    console.log('After stop signalInfo.type:', signalInfo.type, '(expected: "recording")');
    console.log('After stop signalInfo.signal:', signalInfo.signal, '(expected: "stop")');

    console.log('Stopped?');
}

function shutdown() {
  console.log('Shutting down OBS');

  try {
      osn.NodeObs.OBS_service_removeCallback();
      osn.NodeObs.IPC.disconnect();
  } catch(e) {
      throw Error('Exception when shutting down OBS process' + e);
  }

  console.log('OBS shutdown successfully');
}

try {
  init();
  createSource();
  record().then(shutdown);
} catch (err) {
  console.log(err)
}
