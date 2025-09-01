# Install & Setup (macOS)

This project requires Ultraleap Gemini (Hand Tracking v5+) and the Ultraleap WebSocket bridge to run on macOS. Follow the steps below to set up your development and runtime environment.

---

## 1. Prerequisites

### Xcode Command Line Tools
Ensure Xcode or at least the Command Line Tools are installed:
```bash
xcode-select --install
```

### Homebrew
If you don’t have Homebrew installed yet:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Ultraleap Gemini (Hand Tracking v5 or newer)
- Download & install the [Ultraleap Gemini Hand Tracking Software](https://developer.leapmotion.com/tracking-software-download).  
- Plug in your Ultraleap Controller and verify in the **Ultraleap Control Panel** that the device shows up and the Visualizer displays live hands.

---

## 2. Build the Ultraleap WebSocket Bridge

The Gemini SDK does not expose the old WebSocket port directly. You’ll need the **Ultraleap Tracking WebSocket bridge**.

1. Install **libwebsockets**:
   ```bash
   brew install libwebsockets
   ```

2. Clone the bridge repository:
   ```bash
   git clone https://github.com/ultraleap/UltraleapTrackingWebSocket.git
   cd UltraleapTrackingWebSocket
   ```

3. Prepare build folder:
   ```bash
   mkdir build
   cd build
   ```

4. Build the solution and executable:
   ```bash
   cmake ..
   cmake --build .
   ```

This will produce an executable (e.g., `UltraleapTrackingWebSocket`) inside `build/`.

---

## 3. Running the Bridge

Start the bridge before launching the app:
```bash
./UltraleapTrackingWebSocket
```

By default, it listens on:
```
ws://127.0.0.1:6437
```

This is the endpoint the app connects to via LeapJS.

---

## 4. Recommended

- Add the bridge binary to your `$PATH` or copy it to `/usr/local/bin` for convenience.  
- (Optional) Create a `LaunchAgent` to start the bridge automatically when you log in.  

Example `LaunchAgent` (save as `~/Library/LaunchAgents/com.ultraleap.websocket.plist`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.ultraleap.websocket</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/UltraleapTrackingWebSocket</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PORT</key><string>6437</string>
  </dict>
  <key>StandardOutPath</key><string>/tmp/ul_ws.out</string>
  <key>StandardErrorPath</key><string>/tmp/ul_ws.err</string>
</dict>
</plist>
```

Load it with:
```bash
launchctl load ~/Library/LaunchAgents/com.ultraleap.websocket.plist
```

---

⚠️ Without the WebSocket bridge running, the app will not receive hand tracking frames from Ultraleap Gemini.
