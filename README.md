# Bill's Phone - WebRTC Communication App

## Recent Updates (May 2025)
- Added full CRUD support for family user profiles (create, edit, delete) in both backend and frontend.
- Updated backend CORS settings to allow DELETE and PATCH methods for web app CRUD operations.
- Redesigned UI: Profiles are now displayed at the top with profile pictures and names; management features are below.
- Improved error handling and feedback in the web app.

## Future Development Notes
- [ ] **Multi-Person Call Support:**
  - Future versions will allow multiple family members to join a group call with Bill if their availabilities align.
  - Bill will always be the primary callee; other users do not call each other directly.
- [ ] **Push Notifications:**
  - The iPhone app will support push notifications to alert available family members to join a call with Bill.
  - Only users with matching availability will be notified.
- [ ] **Group Call Scheduling:**
  - Backend will include logic to match availabilities and trigger notifications for group calls.

---

A dedicated WebRTC calling app for Bill, an individual with disabilities. This app is specifically designed to provide simple, accessible video calling functionality through a WebRTC implementation with a focus on ease of use and reliability.

## Current Implementation Status

---

## WebRTC TURN Server Integration & Security Notes (May 2025)

- **Self-hosted TURN server (coturn) is now deployed on the same DigitalOcean droplet as the signaling server.**
    - Configured for maximum compatibility (UDP, TCP, TLS relay support).
    - Credentials and relay URLs are set in `.env` and referenced by all WebRTC clients.
- **Firewall/Security Status:**
    - _No firewall is currently applied at the cloud provider (DigitalOcean) level._
    - All ports (including TURN, signaling server, and database) are open to the public internet for development/testing convenience.
    - **Security Recommendation:**
        - For production, apply a firewall to restrict access:
            - Only expose required ports (e.g., 3478, 5349, 3000) to the public.
            - Limit database port (5432) to trusted IPs or internal only.
            - This can be done via DigitalOcean's firewall or Ubuntu's `ufw`.
        - See below for a sample DigitalOcean firewall rule set:
            - Allow TCP/UDP 3478 (TURN), TCP 5349 (TURN TLS), UDP 49160–49200 (TURN relay)
            - Allow TCP 3000 (signaling server)
            - Restrict PostgreSQL (5432) to trusted IPs only
    - **Proceeding with all ports open for now as explicitly requested, but review security before production launch.**

---

## Upcoming Development Roadmap (PostgreSQL Family User Profiles)

### 1. Docker & Database Integration
- Use `docker-compose.yml` to run both the signaling server and a PostgreSQL database (`db` service).
- Environment variables for DB connection are set in Compose and `.env` files.
- Data persists in a Docker-managed volume.

### 2. Server API Enhancements
- Integrate `pg` and `uuid` libraries for PostgreSQL access.
- On startup, ensure a `family_users` table exists with fields: `id`, `name`, `picture_url`, `email`, `availability`, `created_at`, `updated_at`.
- REST API endpoints:
  - `POST /family-users`: Create or update a family user profile.
  - `GET /family-users`: List all family users.
  - `GET /family-users/:id`: Get a single profile.
  - `PATCH /family-users/:id/availability`: Update availability JSON.

### 3. Web Tester Updates
- Add UI for creating, editing, and deleting family user profiles.
- Allow users to select/upload/crop a profile image (suggested: `react-easy-crop`).
- Add a visual picker for "hours of the week" (suggested: grid or range picker, e.g., `react-big-calendar`).
- Preview and edit all profile info before saving.
- Use the new REST API endpoints for all CRUD operations.

### 4. Library Installation Notes
- Install new server dependencies: `pg`, `uuid` (`npm install pg uuid`).
- For web tester: install UI/image/calendar libraries as needed (`npm install react-easy-crop react-big-calendar`).

### 5. iPhone App (Future)
- Update to use new REST API endpoints for user profiles and schedules.
- Use `expo-image-picker` and a calendar/grid UI for profile setup.
- Add local preview and editing before submitting to server.

### 6. Testing & Deployment
- Use `docker-compose up --build` to start both services.
- Test API endpoints with Postman/curl and web tester.
- Ensure profiles and hours persist and update correctly.
- Document all new endpoints and data formats in the README.

---

### Core Features
- ✅ Basic UI with accessibility-focused design
- ✅ Deployed signaling server on Digital Ocean (http://143.198.180.248:3000)
- ✅ Working WebRTC connectivity between devices
- ✅ Auto-answer functionality for Bill's phone
- ✅ Speakerphone mode integration
- ✅ Unified testing app with role selection
- ✅ Clear role identification and switching UI
- ✅ Detailed connection logging and troubleshooting
- ✅ Log sharing functionality
- ✅ TestFlight distribution for real device testing

### Recent Improvements (Build #7)
- ✅ Auto-answer for incoming calls on Bill's phone
- ✅ Speakerphone enabled by default
- ✅ Prominent role selector with easy toggling
- ✅ Fixed UI layout issues and overlapping elements
- ✅ Improved device identification
- ✅ Added version display for easier tracking
- ✅ OTA update support via EAS Update

## WebRTC Tester Features

The current development is focused on the WebRTC Tester app (`WebRTCRoleTester.js`), which includes:

- **Unified Role Selection**: Single app that can function as either Bill's phone or family caller
- **Auto-Answer**: Automatically answers incoming calls when set as Bill's phone
- **Speakerphone Integration**: Default speakerphone mode for better accessibility
- **Connection Status**: Clear visual indicators of connection state
- **Detailed Logging**: Comprehensive logging of connection events and media handling
- **Debug Tools**: One-tap log sharing via email/messaging
- **Visual Feedback**: Shows both local and remote video streams
- **Network Resilience**: Reconnection handling and error recovery
- **Prominent UI**: Clear interface with high contrast and readable text

### Planned Features for Bill's Final App

- **Simplified Interface**: Further streamlined UI designed specifically for Bill
- **Kiosk Mode**: Locked interface using iOS Guided Access
- **Time-Based Call Restriction**: Calling available during specified hours only
- **Always-On Display**: Screen stays on at all times
- **Simple One-Touch Calling**: Large call button for ease of use
- **Visual Schedule**: Timeline-based UI for time awareness

## Development & Testing Setup

### Important Note for Developers
The free Expo account has hit its build quota limit for May 2025. New builds can be created starting June 1, 2025. In the meantime, use EAS Update for JavaScript-only changes.

### Current Deployment Setup

#### 1. Signaling Server
The WebRTC signaling server is currently deployed on Digital Ocean at:
```
http://143.198.180.248:3000
```

This is already configured in the app and handles the connection between devices with the following device IDs:
- Bill's Phone: `bills-iphone`
- Family Caller: `family-caller`

#### 2. Building & Testing

**For JavaScript-Only Updates (No Build Quota Used):**
```bash
# Push updates to existing installed apps
eas update --branch preview
```

**For Full Builds (After June 1, 2025):**
```bash
# Build for TestFlight distribution
eas build --platform ios --profile preview
```

**Testing on Devices:**
- Ensure both test devices have the app installed via TestFlight
- Set one device as "Bill's Phone" and the other as "Family Caller" using the role selector
- Test calling in both directions
- Verify auto-answer functionality on Bill's phone
- Confirm speakerphone is working correctly

### Troubleshooting

- **WebRTC Connection Issues**: Check the signaling server is running and accessible
- **Media Not Showing**: Review permissions and camera/microphone access
- **Updates Not Applying**: Force close and reopen the app, or check build compatibility
- **Log Sharing**: Use the "Share Logs" button to send diagnostic information

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
6. Test the profile image and animated outline effect

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
   - Supports custom device IDs ("bills-iphone" and "family-caller")
   - Deployed on Digital Ocean at http://143.198.180.248:3000

## Next Development Steps

### June 2025 Plan
1. Create a dedicated UI specifically for Bill's phone
   - Simplified interface with larger buttons
   - High contrast colors and clear visual feedback
   - Remove technical options/settings from Bill's version

2. Split the codebase into two distinct apps:
   - Bill's Phone: Minimal, guided interface with auto-answer
   - Family Caller: More controls and feedback for family members

3. Add scheduling functionality:
   - Time-based availability (e.g., 5PM-10PM EST)
   - Visual timeline representation for time awareness
   - Clear feedback when outside call hours

4. Enhance reliability:
   - Automatic reconnection after network interruptions
   - Persistent device registration with the signaling server
   - Clear status indicators for connection state

### Technical Debt & Future Improvements
- Refactor WebRTC connection handling for better error recovery
- Add unit tests for critical connection paths
- Implement metrics collection for monitoring connection quality
- Create a web dashboard for family members to check Bill's device status

## File Structure

### Key Files
- `WebRTCRoleTester.js` - The main testing app that supports both roles
- `index.js` - Main entry point that loads the appropriate component
- `app.json` - Configuration for the Expo/React Native app
- `eas.json` - EAS Build configuration for TestFlight distribution

## Contact & Support
For questions about this project, please contact the project maintainer.

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

1. **Signaling Server Setup on Digital Ocean**:
   - The signaling server is deployed on a Digital Ocean Docker droplet
   - Server URL: `http://143.198.180.248:3000`
   - Device IDs: `bills-iphone` and `family-caller`

   To rebuild or update the server:
   ```bash
   # SSH into the Digital Ocean droplet
   ssh root@143.198.180.248

   # Navigate to the project directory (or clone it if needed)
   cd bill_phone
   # If needed: git clone https://github.com/jmolds/bill_phone.git

   # Pull latest changes if needed
   git pull

   # Stop and remove existing container if it exists
   docker stop bills-server
   docker rm bills-server

   # Build the Docker image
   docker build -t bills-signaling-server .

   # Run the container with auto-restart
   docker run -d -p 3000:3000 --restart=always --name bills-server bills-signaling-server

   # Verify the container is running
   docker ps
   docker logs bills-server
   ```

   **Firewall Configuration**:
   - Ensure port 3000 is open for WebRTC signaling
   ```bash
   ufw allow 3000/tcp
   ```

2. **Final App Build**:
   ```bash
   # Install EAS CLI if not already installed
   npm install -g eas-cli
   
   # Login to your Expo account
   eas login
   
   # Configure the project (only needed once)
   eas build:configure --platform ios
   
   # Create a production build
   eas build --platform ios
   
   # For development/testing builds with WebRTC functionality
   eas build --profile development --platform ios
   
   # Submit to App Store or TestFlight
   eas submit -p ios
   ```

3. **TestFlight Distribution**:
   ```bash
   # Build for TestFlight
   eas build --platform ios --profile production
   
   # Submit to TestFlight
   eas submit -p ios
   ```
   - Add testers in App Store Connect → TestFlight → External Testing
   - Testers receive an email with instructions to install TestFlight
   - NOTE: TestFlight builds expire after 90 days

4. **Long-Term Deployment Options**:
   
   **Option A: Regular TestFlight Updates**
   - Create a calendar reminder to rebuild every 80-85 days
   - Submit new builds to TestFlight before expiration
   - Pros: Simple, no App Store review needed for updates
   - Cons: Requires regular maintenance, builds expire
   
   **Option B: App Store Distribution**
   - Complete App Store metadata in App Store Connect
   - Submit for formal App Review (mention accessibility purpose)
   - Once approved, app can be installed from the App Store
   - Pros: Permanent installation, no expirations
   - Cons: Full App Store review required, may need adjustments
   
   **Option C: Enterprise Distribution**
   - Requires Apple Enterprise Developer Program ($299/year)
   - Create in-house distribution profile
   - Distribute directly via MDM or web link
   - Pros: No App Store, no expirations, full control
   - Cons: More expensive, requires enterprise account

## Web Tester and Device ID Configuration

The system uses specific device IDs to ensure consistent and secure connections:

1. **Device IDs**:
   - Bill's iPhone: `bills-iphone`
   - Family Caller: `family-caller`

2. **Web Tester Setup**:
   - Located in the `web-tester` directory
   - Configured to connect to `http://143.198.180.248:3000`
   - Run locally with: `npx http-server -p 8080`
   - Or open the HTML file directly in a browser

3. **Testing Procedure**:
   - Open web tester and select the "Family Caller" role
   - Connect to the signaling server
   - On the iPhone, ensure the app is running and connected
   - Initiate a call from either direction
   - Verify audio and video quality
   - Test call acceptance, rejection, and ending

4. **Troubleshooting**:
   - If devices can't connect, check server logs: `docker logs bills-server`
   - Ensure port 3000 is open on the firewall
   - Verify both devices are online and registered with the correct IDs
   - Camera and microphone permissions must be granted in both environments

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