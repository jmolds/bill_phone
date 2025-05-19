# Bill's Phone - Kiosk App

A dedicated kiosk-mode WebRTC calling app for Bill, an individual with disabilities. This app is specifically designed to provide simple, accessible video calling functionality through a WebRTC implementation with an intuitive timeline-based UI that visually represents the time of day.

## Current Implementation Status

- ✅ Basic UI with accessibility-focused design
- ✅ Enhanced UI with timeline visualization for time of day
- ✅ Landscape orientation optimization
- ✅ Time-based calling availability (5PM-10PM EST)
- ✅ Call rate limiting (once per hour) 
- ✅ Status indicators and clear visual feedback
- ✅ App resolves compatibility issues with iOS 18.5
- ✅ Working signaling server implementation
- ✅ Simulation mode for testing app flow without WebRTC
- ⏳ Complete WebRTC integration with main app UI
- ⏳ Profile images for contacts
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

### Complete Testing Workflow

#### 1. Start the Signaling Server

The signaling server handles WebRTC connection setup between devices:

```bash
# Build and run the Docker container
docker build -t bills-signaling-server .
docker run -p 3000:3000 --name bills-server bills-signaling-server
```

Or run it directly:

```bash
npm install
node server.js
```

**Important:** Note your computer's IP address (use `ipconfig` on Windows) to configure the client apps. The signaling server runs on port 3000 by default.

#### 2. Configure Server URL

Before testing, update the server URL in the WebRTC components:

1. Open `components/WebRTCTest.js`
2. Change line 20: `const SIGNALING_SERVER_URL = 'http://YOUR_SERVER:3000';`
3. Replace `YOUR_SERVER` with your computer's actual IP address

#### 3. Testing App Modes

a. **Simulation Mode** (Works in Expo Go, no WebRTC):
```bash
npx expo start
```

This mode allows testing the UI flow but doesn't include actual WebRTC functionality.

b. **WebRTC Test Environment**:
```bash
cd web-tester
npx http-server -p 8080
```

c. **Development Build with WebRTC** (Requires Apple Developer Account):
```bash
# Install EAS CLI if not already installed
npm install -g eas-cli

# Log in to your Expo account
eas login

# Configure the project (only needed once)
eas build:configure --platform ios

# Create a development build
eas build --profile development --platform ios
```

#### 4. Testing Between Devices

- Both devices must be on the same network
- Ensure the signaling server is running and accessible
- Register devices with different IDs (e.g., "bill" and "caller")
- For simulation: Use Expo Go (no real WebRTC)
- For WebRTC: Use development build on iPhone or web tester
- Test calling in both directions

## Testing on Bill's iPhone

### Option 1: Simulation Mode (Expo Go)

This approach is quick but won't include WebRTC functionality:

1. Install the Expo Go app from the App Store on Bill's iPhone
2. Make sure the iPhone is on the same network as your development machine
3. Run `npx expo start` on your development machine
4. Scan the QR code with Bill's iPhone camera
5. The app will open in Expo Go with the timeline UI but no actual calling features

### Option 2: Development Build (Full Functionality)

This approach provides the complete experience with WebRTC:

1. Run `eas build --profile development --platform ios`
2. Follow the prompts to set up your Apple Developer account credentials
3. Wait for the build to complete (10-15 minutes for first build)
4. Scan the QR code provided by EAS to install the development build
5. The app will include all native modules including WebRTC

### Using the Development Build

1. Before testing, ensure the signaling server is running
2. Update the server URL in the WebRTC components with your computer's IP
3. Run the app and test both incoming and outgoing calls
4. Test the timeline visualization and time-based availability
5. Verify that the app operates correctly in landscape mode

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

### Architecture Overview

The WebRTC implementation includes these components:

1. **Signaling Server** (server.js):
   - Handles device registration and message relay
   - Socket.io for real-time connection
   - Supports custom device IDs ("bill" and "caller")
   - Already implemented but needs deployment

2. **WebRTC Test Component** (components/WebRTCTest.js):
   - Basic implementation for testing connections
   - Needs to be integrated with main UI

3. **WebRTC Call Component** (components/WebRTCCall.js):
   - Integration point for the main app
   - Needs to be completed with proper UI integration

### Key Tasks Remaining

1. **Complete the WebRTCCall.js Component**:
   - Integrate with the timeline UI in App.js
   - Add proper call screens with accept/decline buttons
   - Implement haptic feedback for incoming calls
   - Handle network interruptions gracefully

2. **Add Profile Images**:
   - Replace the generic call button with contact images
   - Add profile images to the `assets` folder
   - Implement the white outline animation effect

3. **Call Flow Integration**:
   - Incoming: Trusted Contact → Signaling Server → Bill's iPhone → Accept/Decline
   - Outgoing: Bill's iPhone → Signaling Server → Trusted Contact → Accept/Decline
   - Call state management (incoming, outgoing, connected, ended)

4. **Deployment Configuration**:
   - Configure the signaling server for production
   - Set up the companion app for trusted contacts
   - Update server URLs for production environment

## Deploying to Bill's iPhone for Kiosk Use

### Production Deployment Steps

1. **Signaling Server Setup**:
   - Deploy the signaling server to a reliable host (Digital Ocean recommended)
   - Configure environment variables for production mode
   - Update the WebRTC components with the production server URL

2. **Final App Build**:
   ```bash
   # Create a production build
   eas build --platform ios
   
   # Submit to App Store or TestFlight
   eas submit -p ios
   ```

3. **App Store Distribution**:
   - Complete the App Store Connect information
   - Submit for App Review (mention accessibility purpose)
   - Once approved, install from the App Store

### Guided Access Setup (Kiosk Mode)

1. **Configure Guided Access**:
   - On Bill's iPhone, go to Settings → Accessibility → Guided Access
   - Turn on Guided Access and enable Accessibility Shortcut
   - Set a secure passcode (should only be known to caregivers)

2. **Activate Kiosk Mode**:
   - Open the Bill's Phone app
   - Triple-click the home/side button to activate Guided Access
   - Configure allowed areas and options:
     - Allow touch on the call button area
     - Disable hardware buttons except volume
     - Disable auto-screen lock (ensure charger is connected)
   - Tap "Start" in the top right

3. **Exit Guided Access** (Caregiver only):
   - Triple-click home/side button
   - Enter the passcode

### Single App Mode (For More Permanent Installation)

For a more permanent kiosk setup, Single App Mode provides a fully managed solution:

**Requirements**:
- Apple Developer Enterprise Program OR
- Apple Configurator 2 (recommended for this use case)

**Setup Steps**:
1. Install Apple Configurator 2 on a Mac
2. Connect Bill's iPhone to the Mac via USB
3. Create a configuration profile with:
   - Single App Mode restriction pointing to Bill's Phone app
   - Auto-start after restart
   - Disable all gestures except those needed for the app
   - Configure auto-brightness and volume settings
   - Enable automatic updates for the app
4. Deploy the profile to Bill's iPhone
5. The device will now permanently run in kiosk mode

**Benefits**:
- Auto-starts after power cycle
- More restrictive than Guided Access
- Can be updated remotely by the administrator
- Prevents accidental exit

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

### Usage Instructions for Bill

### Timeline UI

The main screen shows a timeline visualization that helps Bill understand the time of day:

1. **Timeline Visualization**:
   - The horizontal lines at the top and bottom show the time of day (9AM-9PM)
   - A glowing dot shows the current time position
   - "Jogs" at the ends indicate sleep hours (before 9AM and after 9PM)

2. **Making a Call**:
   - When in the available calling hours (5PM-10PM EST), a call button appears
   - The button will show the profile image of the trusted contact
   - Tap once to initiate the call
   - Only one call attempt per hour is allowed

3. **Receiving a Call**:
   - When a call comes in, the phone vibrates and displays an incoming call screen
   - The caller's profile image is displayed prominently
   - Tap the green "Answer" button to accept
   - Tap the red "Decline" button to reject

4. **During a Call**:
   - The video of the caller fills most of the screen
   - Tap "End Call" (red button) to hang up
   - Use the "Mute" button to toggle the microphone
   - Use the "Speaker" button to toggle speaker mode

5. **After Hours**:
   - Outside of calling hours, the timeline still shows the time of day
   - No call buttons are displayed
   - The screen stays on at all times in kiosk mode

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

### Completed Components

1. **Signaling Server**:
   - ✅ Complete implementation in server.js
   - ✅ Socket.io for real-time communication
   - ✅ Custom device ID registration ("bill"/"caller")
   - ✅ Signal routing between devices
   - ✅ Error handling and reconnection logic

2. **WebRTC Testing**:
   - ✅ Web-based testing environment in web-tester folder
   - ✅ Basic WebRTCTest.js component for connection testing
   - ✅ Docker configuration for the signaling server

3. **Main App UI**:
   - ✅ Timeline visualization with current time indicator
   - ✅ Landscape mode optimization
   - ✅ Time-based calling restrictions
   - ✅ Rate limiting for calls

### Deployment Progress

1. **iOS Configuration**:
   - ✅ EAS project configured
   - ✅ Development build profile set up
   - ✅ Apple Developer account linked

### Next Development Tasks

1. **WebRTC Integration**:
   - Create and test the development build with WebRTC modules
   - Integrate WebRTCCall.js with the main UI
   - Implement call screens and transitions
   - Add proper error recovery for network issues

2. **Companion App**:
   - Create a simplified caller app for trusted contacts
   - Test bidirectional calling with the signaling server
   - Ensure compatibility across platforms if needed

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


## NOTE:
Consider adding automated recovery mechanisms for common edge cases like network interruptions during calls or unexpected WebRTC disconnections.