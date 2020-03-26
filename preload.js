const path = require('path');

const osn = require("obs-studio-node");

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


// Some copy-paste from obs-studio-node test suite that need to be fixed
// function getNextSignalInfo() {
//     return new Promise((resolve, reject) => {
//         this.signals.pipe(first()).subscribe(signalInfo => resolve(signalInfo));
//         setTimeout(() => reject('Output signal timeout'), 30000);
//     });
// }

// Init the library
console.log('Initializing OBS...');
osn.NodeObs.IPC.host('eletest-pipe'); // Usually some UUIDs go there
osn.NodeObs.SetWorkingDirectory(path.join(__dirname, 'node_modules', 'obs-studio-node'));
const obsDataPath = path.join(__dirname, 'osn-data'); // OBS Studio configs and logs
const initResult = osn.NodeObs.OBS_API_initAPI('en-US', obsDataPath, "1.1.4");
console.log('OBS Init result: ', initResult); // Should be 0 (Success)

console.log(osn.NodeObs)
// This stuff seems not to make any difference, so commented
// console.log('OBS Autoconfig...');
// function handleProgress(progress) {
//     console.log('OBS Autoconfiguration progress:', progress);
//     if (progress.event === 'stopping_step') {
//       if (progress.description === 'bandwidth_test') {
//         osn.NodeObs.StartStreamEncoderTest();
//       } else if (progress.description === 'streamingEncoder_test') {
//         osn.NodeObs.StartRecordingEncoderTest();
//       } else if (progress.description === 'recordingEncoder_test') {
//         osn.NodeObs.StartCheckSettings();
//       } else if (progress.description === 'checking_settings') {
//         osn.NodeObs.StartSaveStreamSettings();
//       } else if (progress.description === 'saving_service') {
//         osn.NodeObs.StartSaveSettings();
//       } else if (progress.description === 'setting_default_settings') {
//         osn.NodeObs.StartSaveStreamSettings();
//       }
//     }
// }
//
// osn.NodeObs.InitializeAutoConfig(
//     (progress) => {
//       handleProgress(progress);
//     },
//     { continent: '', service_name: '' },
//   );

// TODO: Most probably here should be some OBS plugins setup step?

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function record() {

    await sleep(1000);

    console.log('Manual config:');
    setSetting('Output', 'Mode', 'Simple');
    setSetting('Output', 'StreamEncoder', 'x264');
    setSetting('Output', 'FilePath', path.join(path.normalize(__dirname), 'videos'));

    // Start recording
    // let signalInfo;

    console.log('Starting recording...');
    // osn.NodeObs.OBS_service_startRecording();

    console.log('Started?');
    // signalInfo = await obs.getNextSignalInfo();

    // if (signalInfo.signal == EOBSOutputSignal.Stop) {
    //     throw Error(signalInfo.error);
    // }

    // console.log('Started signalInfo.type:', signalInfo.type, `(expected: ${EOBSOutputType.Recording}`);
    // console.log('Started signalInfo.signal:', signalInfo.signal, `(expected: ${EOBSOutputType.Stop}`);

    // Recording...
    await sleep(500);

    // Stopping...
    osn.NodeObs.OBS_service_stopRecording();

    // signalInfo = await getNextSignalInfo();

    // console.log('On stop signalInfo.type:', signalInfo.type, `(expected: ${EOBSOutputType.Recording}`);
    // console.log('On stop signalInfo.signal:', signalInfo.signal, `(expected: ${EOBSOutputType.Stop}`);

    // signalInfo = await getNextSignalInfo();

    // console.log('After stop signalInfo.type:', signalInfo.type, `(expected: ${EOBSOutputType.Recording}`);
    // console.log('After stop signalInfo.signal:', signalInfo.signal, `(expected: ${EOBSOutputType.Stop}`);

    console.log('Stopped?');
}
try {
record();
} catch (err) {
    console.log(err)
}