const path = require('path');
const { Subject } = require('rxjs');
const { first } = require('rxjs/operators');

const osn = require("obs-studio-node");

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
  setSetting('Output', 'StreamEncoder', 'x264');
  setSetting('Output', 'FilePath', path.join(__dirname, 'videos'));

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
    await sleep(2500);

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

  record().then(shutdown);
} catch (err) {
  console.log(err)
}
