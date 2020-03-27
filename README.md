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

## Use with your own build of [obs-studio-node]

 1. Build it somewhere ([look at the docs first](https://github.com/stream-labs/obs-studio-node#building))

    ```sh
    git clone https://github.com/stream-labs/obs-studio-node.git
    cd obs-studio-node
    yarn install
    git submodule update --init --recursive
    mkdir build
    cd build
    cmake .. -G"Visual Studio 15 2017" -A x64 -DCMAKE_INSTALL_PREFIX="SOME_WRITABLE_PATH"
    cmake --build . --config Release
    cpack -G TGZ
    ```

 2. Place path to it to `package.json`:

    ```json
    {
        "devDependencies": {
            "obs-studio-node": "file://C:/where/you/cloned/obs-studio-node/build/obs-studio-node-0.3.21-win64.tar.gz"
        }
    }

 3. Install it to `node_modules/`

    ```sh
    yarn install
    ```

 4. Launch as usual:

    ```
    yarn start
    ```

## Misc

OBS logs can be found in `osn-data\node-obs\logs`.

[obs-studio-node]: https://github.com/stream-labs/obs-studio-node "libOBS (OBS Studio) for Node.JS, Electron and similar tools"
