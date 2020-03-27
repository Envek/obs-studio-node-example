# Very simple example of [obs-studio-node] usage

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

It launches and writes 30 seconds of your desktop video, audio, and microphone to the video file in `videos/` subfolder. Look at console output in the Dev Tools.

See [this topic](https://obsproject.com/forum/threads/laptop-black-screen-when-capturing-read-here-first.5965/) on how to solve black screen on laptops with two video cards.

Works only on Windows.

## Misc

OBS logs can be found in `osn-data\node-obs\logs`.

[obs-studio-node]: https://github.com/stream-labs/obs-studio-node "libOBS (OBS Studio) for Node.JS, Electron and similar tools"
