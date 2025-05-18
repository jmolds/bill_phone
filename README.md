# Bill's Phone - Kiosk App

A dedicated kiosk-mode WebRTC calling app for Bill, an individual with disabilities. This app is specifically designed to provide simple, accessible video calling functionality through a WebRTC implementation.

## Current Implementation Status

- ✅ Basic UI with accessibility-focused design
- ✅ Time-based calling availability (5PM-10PM EST)
- ✅ Call rate limiting (once per hour) 
- ✅ Status indicators and clear visual feedback
- ✅ App resolves compatibility issues with iOS 18.5
- ✅ Simulation mode for testing app flow without WebRTC
- ⏳ WebRTC implementation in development
- ⏳ Call receiving functionality (ready for next developer)

## Features

- **Accessibility-Focused UI**: Large buttons, clear visuals, and simple interface
- **Kiosk Mode**: Locked interface using iOS Guided Access
- **Time-Based Call Restriction**: Calling only available during evening hours (5PM-10PM EST)
- **Always-On Display**: Screen stays on at all times
- **Simple One-Touch Calling**: Large call button for ease of use
- **Restricted Calling**: Only calls to/from pre-configured trusted contact
- **Network Status Monitoring**: Clear indication of connection status
- **Auto-Recovery**: Reconnects automatically after network interruptions
- **Haptic Feedback**: Vibration alerts for incoming calls and status changes

## Development Setup

### Development Testing Workflow

1. **Start the Signaling Server:**
   ```
   docker build -t bills-signaling-server .
   docker run -p 3000:3000 --name bills-server bills-signaling-server
   ```

2. **Testing App Modes:**

   a. **Simulation Mode** (Works in Expo Go, no WebRTC):
   ```
   npm start
   ```
   
   b. **WebRTC Test Environment** (For WebRTC connection testing):
   ```
   cd web-tester
   npx http-server -p 8080
   ```
   
   c. **Development Build** (Required for WebRTC on iOS):
   ```
   # Requires an Apple Developer account ($99/year)
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build --profile development --platform ios
   ```

3. **Testing Between Two Devices:**
   - For simulation testing: Use Expo Go on both devices
   - For WebRTC testing: Use the web tester or EAS development build
   - Both devices must be on the same network
   - Update the server URL to use your computer's IP address
   - Test calling in both directions

### Testing on iPhone

1. Download the Expo Go app from the App Store
2. Make sure your iPhone is on the same network as your development machine
3. Scan the QR code shown in the terminal or visit the URL
4. The app will load on your iPhone

## Technical Architecture

### Current Implementation

The app currently includes:

1. **Main Interface (App.js)**:
   - Time display with current time
   - Status indicator for call availability
   - Conditional rendering of call button based on time and rate limiting
   - Large, accessible UI optimized for users with disabilities
   - Black background with minimal interface elements

### For Next Developer: WebRTC Implementation

The WebRTC implementation should use these components:

1. **Signaling Server**: Connect to the WebRTC signaling server at `http://YOUR_SERVER:3000`
2. **Connection Persistence**: Implement automatic reconnection with exponential backoff
3. **Device Authentication**: Register with a unique device ID for Bill's device
4. **Call Flow**:
   - Incoming: Trusted Contact → Signaling Server → Bill's iPhone → Accept/Decline
   - Outgoing: Bill's iPhone → Signaling Server → Trusted Contact → Accept/Decline

### Key Components to Develop

- **WebRTCCall.js**: Create or update this component for WebRTC implementation
- **Call UI**: Implement calling screens with simple accept/decline buttons
- **Call State Management**: Handle call states (incoming, outgoing, connected, ended)

## Deploying to iPhone for Kiosk Use

### Guided Access Setup (Recommended Method)

1. On the iPhone, go to Settings → Accessibility → Guided Access
2. Turn on Guided Access and enable Accessibility Shortcut
3. Set a secure passcode (should only be known to caregivers)
4. Open the app
5. Triple-click the home/side button to activate Guided Access
6. Configure options:
   - Circle and disable areas of the screen that shouldn't be touched
   - Disable hardware buttons except those needed
   - Enable auto-screen lock timeout (if needed)
7. Tap "Start" in the top right

To exit: Triple-click home/side button and enter passcode.

### Single App Mode (For More Permanent Installation)

This requires Apple Developer Enterprise Program membership or Apple Configurator:

1. Use Apple Configurator 2 on a Mac
2. Create a configuration profile with Single App Mode
3. Configure accessibility settings within the profile
4. Deploy to Bill's device

## Production Build

For production deployment:

1. **Requirements**:
   - Apple Developer Account ($99/year) - Required for any iOS distribution
   - EAS Build (cloud service) or Xcode on a Mac
   - App Store provisioning profile

2. **Build with Expo EAS** (Build in the cloud without a Mac):
   ```
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build --platform ios
   ```

3. **Install for Testing**:
   - Development builds can be installed directly via QR code
   - Production builds require TestFlight or App Store distribution
   
4. **App Store Submission**:
   ```
   eas submit -p ios
   ```

## Usage Instructions for Bill

1. **Making a Call**: When the green "Call" button is available (evenings 5-10PM EST), tap it once to call the pre-configured trusted contact.
2. **Receiving a Call**: When a call comes in, the phone will vibrate and display "Incoming Call" with two buttons:
   - Tap the green "Answer" button to accept the call
   - Tap the red "Decline" button to reject the call
3. **During a Call**: 
   - Tap "End Call" to hang up
   - Use the "Mute" button to toggle microphone
   - Use the "Speaker" button to toggle speaker mode

## Caregiver Instructions

1. **Setting Up**: Follow the deployment instructions to install on Bill's iPhone
2. **Monitoring**: The app shows network status and call availability clearly
3. **Troubleshooting**:
   - If calls aren't connecting, check the network connection
   - If the app stops responding, exit Guided Access mode (triple-click + passcode) and restart the app
   - For persistent issues, check the signaling server status

## Implementation Notes

### Recent Fixes

- Fixed compatibility issues between Expo SDK and iOS
- Implemented a minimal setup that reliably runs on Bill's iPhone
- Added proper dependency management to ensure compatibility

### WebRTC Implementation Status

1. **Completed Steps**:
   - ✅ Working signaling server implementation
   - ✅ Simplified device registration with friendly IDs (bill/caller)
   - ✅ Signal routing between devices verified
   - ✅ Web-based WebRTC testing environment

2. **Next Steps for WebRTC Integration**:
   - Create EAS development build with WebRTC native modules
   - Integrate the WebRTCTest.js component with the main app
   - Update the app to use the signaling server
   - Implement proper error handling for network issues

3. **Companion App Development**:
   - Develop a simple caller app for Bill's contacts to use
   - Test bidirectional calling with the same signaling server
   - Ensure compatibility across iOS and Android if needed

4. **Accessibility & Reliability Features**:
   - Implement haptic feedback for call events
   - Ensure all UI elements are properly sized
   - Test with VoiceOver and other accessibility services
   - Verify Guided Access functionality works with the final app
   - Ensure app recovers from crashes or restarts
   - Test auto-reconnection to WebRTC after network interruptions

### Future Enhancements

1. **Auto-answer** for trusted contacts
2. **Emergency contact options** for urgent situations
3. **Voice activation** for hands-free operation
4. **Remote monitoring** capabilities for caregivers
5. **Custom time window configuration** for call availability
