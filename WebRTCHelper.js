/**
 * WebRTC Configuration Helper for Bill's Phone iOS App
 * Fetches ICE server configuration from the signaling server
 * NO HARDCODED SECRETS - All configuration comes from server
 */

const SERVER_URL = 'https://api.justinmolds.com';

// Basic STUN-only fallback (no secrets)
const STUN_ONLY_FALLBACK = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ],
  iceCandidatePoolSize: 10,
  iceTransportPolicy: 'all',
  bundlePolicy: 'max-bundle',
  rtcpMuxPolicy: 'require'
};

/**
 * Fetches WebRTC configuration from the signaling server
 * @param {Function} logger - Logging function (defaults to console.log)
 * @returns {Promise<Object>} WebRTC configuration object
 */
export const getWebRTCConfiguration = async (logger = console.log) => {
  try {
    logger('🔧 Fetching WebRTC configuration from server...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    const response = await fetch(`${SERVER_URL}/webrtc-config`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'BillPhone-iOS/1.0.0',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const config = await response.json();
    logger(`✅ Server provided ${config.iceServers?.length || 0} ICE servers`);
    
    // Validate the configuration
    if (!config.iceServers || config.iceServers.length === 0) {
      throw new Error('Server returned empty ICE server list');
    }

    // Log ICE servers (without exposing credentials)
    config.iceServers.forEach((server, index) => {
      const serverType = server.urls.includes('turn:') ? 'TURN' : 
                        server.urls.includes('turns:') ? 'TURNS' : 'STUN';
      const hasAuth = server.username ? '🔐 (authenticated)' : '🌐 (no auth)';
      logger(`   ${index + 1}. ${serverType}: ${server.urls} ${hasAuth}`);
    });

    // Enhance configuration with iOS optimizations
    const enhancedConfig = {
      ...config,
      iceCandidatePoolSize: config.iceCandidatePoolSize || 10,
      iceTransportPolicy: config.iceTransportPolicy || 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require'
    };

    logger('✅ WebRTC configuration ready with iOS optimizations');
    return enhancedConfig;

  } catch (error) {
    logger(`❌ Failed to fetch WebRTC config: ${error.message}`);
    logger('⚠️  Using STUN-only fallback (TURN features disabled)');
    logger('💡 Calls may not work through NAT/firewalls without TURN servers');
    
    // Log fallback servers (STUN only - no secrets)
    logger('📋 Fallback ICE servers (STUN only):');
    STUN_ONLY_FALLBACK.iceServers.forEach((server, index) => {
      logger(`   ${index + 1}. STUN: ${server.urls} 🌐 (no auth)`);
    });
    
    return STUN_ONLY_FALLBACK;
  }
};

/**
 * Tests connectivity to the signaling server
 * @param {Function} logger - Logging function
 * @returns {Promise<boolean>} True if server is reachable
 */
export const testServerConnectivity = async (logger = console.log) => {
  try {
    logger('🌐 Testing signaling server connectivity...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${SERVER_URL}/health`, {
      method: 'GET',
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const health = await response.json();
      logger(`✅ Server reachable - Status: ${health.status}`);
      return true;
    } else {
      logger(`❌ Server returned ${response.status}: ${response.statusText}`);
      return false;
    }
  } catch (error) {
    logger(`❌ Server connectivity test failed: ${error.message}`);
    return false;
  }
};

/**
 * Tests WebRTC ICE gathering (validates TURN connectivity)
 * @param {Function} logger - Logging function
 * @returns {Promise<Object>} Test results object
 */
export const testICEGathering = async (logger = console.log) => {
  try {
    logger('🧪 Testing ICE candidate gathering...');
    
    const config = await getWebRTCConfiguration(logger);
    
    // Import WebRTC components
    const { RTCPeerConnection } = require('react-native-webrtc');
    const pc = new RTCPeerConnection(config);
    
    return new Promise((resolve) => {
      const results = {
        totalCandidates: 0,
        stunCandidates: 0,
        turnCandidates: 0,
        hostCandidates: 0,
        success: false
      };
      
      const timeout = setTimeout(() => {
        logger(`⏱️  ICE gathering timeout - Found ${results.totalCandidates} candidates`);
        pc.close();
        resolve(results);
      }, 10000);
      
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          results.totalCandidates++;
          
          const candidate = event.candidate;
          if (candidate.type === 'host') {
            results.hostCandidates++;
            logger(`   📍 Host candidate: ${candidate.address || 'hidden'}`);
          } else if (candidate.type === 'srflx') {
            results.stunCandidates++;
            logger(`   🌐 STUN candidate: ${candidate.address || 'hidden'}`);
          } else if (candidate.type === 'relay') {
            results.turnCandidates++;
            logger(`   🔄 TURN candidate: ${candidate.address || 'hidden'}`);
            results.success = true; // TURN is working
          }
        }
      };
      
      pc.onicegatheringstatechange = () => {
        logger(`   ICE gathering state: ${pc.iceGatheringState}`);
        if (pc.iceGatheringState === 'complete') {
          clearTimeout(timeout);
          
          logger(`✅ ICE gathering complete:`);
          logger(`   Total: ${results.totalCandidates}, Host: ${results.hostCandidates}, STUN: ${results.stunCandidates}, TURN: ${results.turnCandidates}`);
          
          if (results.turnCandidates > 0) {
            logger('🎉 TURN server connectivity confirmed!');
            results.success = true;
          } else if (results.stunCandidates > 0) {
            logger('⚠️  Only STUN connectivity (calls may fail through NAT)');
          } else {
            logger('❌ No external connectivity detected');
          }
          
          pc.close();
          resolve(results);
        }
      };
      
      // Start ICE gathering
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .catch(error => {
          logger(`❌ Error creating offer: ${error.message}`);
          clearTimeout(timeout);
          pc.close();
          resolve(results);
        });
    });
    
  } catch (error) {
    logger(`❌ ICE gathering test failed: ${error.message}`);
    return {
      totalCandidates: 0,
      stunCandidates: 0,
      turnCandidates: 0,
      hostCandidates: 0,
      success: false,
      error: error.message
    };
  }
};

/**
 * Comprehensive connectivity test
 * @param {Function} logger - Logging function
 * @returns {Promise<Object>} Comprehensive test results
 */
export const runConnectivityTests = async (logger = console.log) => {
  logger('🚀 Starting comprehensive connectivity tests...');
  
  const results = {
    serverReachable: false,
    configFetched: false,
    iceGathering: null,
    overall: false
  };
  
  // Test 1: Server connectivity
  results.serverReachable = await testServerConnectivity(logger);
  
  if (!results.serverReachable) {
    logger('❌ Cannot proceed with further tests - server unreachable');
    return results;
  }
  
  // Test 2: Config fetching
  try {
    await getWebRTCConfiguration(logger);
    results.configFetched = true;
  } catch (error) {
    logger(`❌ Config fetch failed: ${error.message}`);
    results.configFetched = false;
  }
  
  // Test 3: ICE gathering
  if (results.configFetched) {
    results.iceGathering = await testICEGathering(logger);
    results.overall = results.iceGathering.success;
  }
  
  logger('\n📊 Test Summary:');
  logger(`   Server reachable: ${results.serverReachable ? '✅' : '❌'}`);
  logger(`   Config fetched: ${results.configFetched ? '✅' : '❌'}`);
  logger(`   TURN working: ${results.iceGathering?.success ? '✅' : '❌'}`);
  logger(`   Overall status: ${results.overall ? '✅ Ready for calls' : '❌ May have issues'}`);
  
  return results;
};