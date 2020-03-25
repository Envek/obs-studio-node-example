# (Not yet working) example of [obs-studio-node] usage

## Setup

```
yarn install
```

## Run

```
yarn start
```

or use `F5` in Visual Studio Code.

## Current state

It segfaults on call to `NodeObs.OBS_service_startRecording()` but `obs64.exe` is continuing to run while writing a ton of following messages to its logs:

```
[Error] WriteFileEx failed with getErrorCode 232
```

I tried to change output folder for videos, to run it with administrator rights,  to upgrade drivers and codecs. But with no luck yet.

Most probably I miss some steps in initialization.

## Misc

OBS logs can be found in `osn-data\node-obs\logs`.

[obs-studio-node]: https://github.com/stream-labs/obs-studio-node "libOBS (OBS Studio) for Node.JS, Electron and similar tools"
