import { registerRootComponent } from 'expo';
// Comment out the production app import
// import App from './App';

// Import the test app for development
import TestApp from './TestApp';

// Register the test component instead
registerRootComponent(TestApp);

// To revert to production app, comment out TestApp
// and uncomment the App import and registration
