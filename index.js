import { registerRootComponent } from 'expo';

// Import all app versions
import App from './App';                            // Full production app with accessibility features
import SimulatedApp from './SimulatedApp';          // UI simulation for Expo Go
import WebRTCTester from './WebRTCTester';          // WebRTC tester for connection verification
import ConnectionTester from './ConnectionTester';   // Socket.IO connection tester
import BillsPhoneMinimal from './BillsPhoneMinimal'; // Minimal version of Bill's phone app
import FamilyCaller from './FamilyCaller';          // Minimal family caller app
import WebRTCRoleTester from './WebRTCRoleTester';  // Unified role-selectable tester

// ===================================================================
// DEVELOPMENT MODE SWITCH
// ===================================================================
// Choose which mode to use:
// - 'PRODUCTION': Full app with accessibility features (requires development build)
// - 'SIMULATION': UI simulation that works in Expo Go without WebRTC
// - 'TESTER': WebRTC tester for verifying connectivity (requires development build)
// - 'CONNECTION': Simple Socket.IO connection tester (works in development build)
// - 'BILLS_MINIMAL': Minimal version of Bill's phone (requires development build) 
// - 'FAMILY_CALLER': App for family members to call Bill (requires development build)
// - 'ROLE_TESTER': Unified app that can be either Bill or Family (requires development build)
const APP_MODE = 'ROLE_TESTER'; // Unified tester with role selection

// Map of modes to components
const APP_COMPONENTS = {
  'PRODUCTION': App,
  'SIMULATION': SimulatedApp,
  'TESTER': WebRTCTester,
  'CONNECTION': ConnectionTester,
  'BILLS_MINIMAL': BillsPhoneMinimal,
  'FAMILY_CALLER': FamilyCaller,
  'ROLE_TESTER': WebRTCRoleTester
};

// Register the appropriate component based on the selected mode
registerRootComponent(APP_COMPONENTS[APP_MODE]);

// Note: After changing the mode, you need to restart the development server
// with 'expo start --clear' for the changes to take effect.

// For simulation testing only:
// registerRootComponent(TestApp);
