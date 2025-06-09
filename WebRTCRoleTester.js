import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
  Share,
  Platform
} from 'react-native';
import * as Updates from 'expo-updates';
import Constants from 'expo-constants';
import { Picker } from '@react-native-picker/picker';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import io from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * WebRTCRoleTester
 * 
 * A unified tester app that can function as either Bill's phone or the family caller.
 * User can select which role they want to play, and the app will behave accordingly.
 * Enhanced with iOS production compatibility fixes.
 */
const WebRTCRoleTester = () => {
  // State - Role selection
  const [role, setRole] = useState('bills-iphone');
  const [targetId, setTargetId] = useState('family-caller');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  
  // Get the build number from app.json
  const buildNumber = Constants.expoConfig?.ios?.buildNumber || '7';

  // State - Connection and call
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, calling, connected
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [logs, setLogs] = useState([]);
  const remoteVideoRef = useRef(null);
  const [mediaDevicesInfo, setMediaDevicesInfo] = useState([]); // For device enumeration

  const [canAutoAnswer, setCanAutoAnswer] = useState(role === 'bills-iphone');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  // Constants
  const SERVER_URL = 'https://api.justinmolds.com';

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const logsRef = useRef([]);

  // Check for updates on startup
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
          log('Update available! Downloading...');
          await Updates.fetchUpdateAsync();
          log('Update downloaded, restarting app...');
          await Updates.reloadAsync();
        } else {
          log('No updates available');
        }
      } catch (error) {
        log(`Error checking for updates: ${error.message}`);
      }
    };
    
    checkForUpdates();
  }, []);
  
  // Load saved role on startup
  useEffect(() => {
    const loadSavedRole = async () => {
      try {
        const savedRole = await AsyncStorage.getItem('selectedRole');
        if (savedRole) {
          setRole(savedRole);
          updateTargetId(savedRole);
          // Set auto-answer based on role
          setCanAutoAnswer(savedRole === 'bills-iphone');
        }
      } catch (e) {
        log('Error loading saved role: ' + e.message);
      }
    };
    
    loadSavedRole();
  }, []);

  // Initialize socket connection when role is selected
  useEffect(() => {
    if (role) {
      connectToSignalingServer();
    }
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        detachSocketEvents();
      }
      cleanupWebRTC();
    };
  }, [role]);

  // Enhanced logging function
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    console.log(logEntry);
    logsRef.current = [...logsRef.current, logEntry];
    setLogs([...logsRef.current]);
  };

  // Helper: enumerate media devices and log them
  const enumerateAndLogDevices = async () => {
    try {
      const devices = await mediaDevices.enumerateDevices();
      setMediaDevicesInfo(devices);
      log('Enumerating media devices:');
      devices.forEach(device => {
        log(`Device: kind=${device.kind}, label=${device.label}, id=${device.deviceId}`);
      });
    } catch (err) {
      log('Error enumerating devices: ' + err.message);
    }
  };
  
  // Enable speaker phone
  const enableSpeakerphone = () => {
    try {
      log('Enabling speakerphone');
      InCallManager.setForceSpeakerphoneOn(true);
      log('Speakerphone enabled');
    } catch (error) {
      log(`Error enabling speakerphone: ${error.message}`);
    }
  };
  
  // Disable speaker phone
  const disableSpeakerphone = () => {
    try {
      log('Disabling speakerphone');
      InCallManager.setForceSpeakerphoneOn(false);
      log('Speakerphone disabled');
    } catch (error) {
      log(`Error disabling speakerphone: ${error.message}`);
    }
  };

  // Share logs function
  const shareLogs = async () => {
    try {
      const logText = logsRef.current.join('\n');
      let deviceDump = '';
      if (mediaDevicesInfo && mediaDevicesInfo.length) {
        deviceDump += '\nMedia Devices:';
        mediaDevicesInfo.forEach(device => {
          deviceDump += `\n  kind=${device.kind}, label=${device.label}, id=${device.deviceId}`;
        });
      }
      const deviceInfo =
        `Device: ${Platform.OS} ${Platform.Version}\n` +
        `Role: ${role}\n` +
        `Target: ${targetId}\n` +
        `Connection: ${connectionStatus}\n` +
        `Call Status: ${callStatus}\n` +
        deviceDump +
        '\n\n';
      await Share.share({
        message: deviceInfo + logText,
        title: 'WebRTC Test Logs'
      });
    } catch (error) {
      Alert.alert('Error Sharing Logs', error.message);
    }
  };

  // Update target ID based on role
  const updateTargetId = (selectedRole) => {
    // If I'm Bill, I call family; if I'm family, I call Bill
    if (selectedRole === 'bills-iphone') {
      setTargetId('family-caller');
      setCanAutoAnswer(true); // Auto-answer for Bill's phone
    } else {
      setTargetId('bills-iphone');
      setCanAutoAnswer(false); // Manual answer for family caller
    }
  };

  // Handle role change
  const handleRoleChange = async (selectedRole) => {
    try {
      // Disconnect from the current session if connected
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      
      // Clean up any active call
      if (callStatus !== 'idle') {
        cleanupWebRTC();
        setCallStatus('idle');
      }
      
      // Update the role and save it
      setRole(selectedRole);
      await AsyncStorage.setItem('selectedRole', selectedRole);
      
      // Update target ID based on new role
      updateTargetId(selectedRole);
      log(`Role changed to: ${selectedRole}, target: ${targetId}`);
      
      // Reconnect to the signaling server with the new role
      connectToSignalingServer();
    } catch (e) {
      log('Error saving role: ' + e.message);
    }
  };

  // Enhanced iOS-compatible connection to signaling server
  const connectToSignalingServer = () => {
    log(`Connecting to signaling server as ${role}...`);
    setConnectionStatus('Connecting...');

    try {
      // Enhanced socket.io options specifically for iOS production builds
      const socketOptions = {
        // Transport configuration - prioritize polling for iOS reliability
        transports: ['polling', 'websocket'],
        
        // Connection settings
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 10000,
        timeout: 30000,
        
        // iOS-specific security settings
        secure: true,
        rejectUnauthorized: false, // Allow self-signed certs in dev
        
        // Force new connection to avoid iOS caching issues
        forceNew: true,
        
        // Headers for iOS compatibility
        extraHeaders: {
          'Origin': 'https://api.justinmolds.com',
          'User-Agent': `BillsPhone-iOS/${Constants.expoConfig?.version || '1.0.0'}`,
          'X-Platform': 'iOS-Production'
        },
        
        // Query parameters for server-side identification
        query: {
          platform: 'ios',
          version: Constants.expoConfig?.version || '1.0.0',
          buildNumber: Constants.expoConfig?.ios?.buildNumber || '7'
        },
        
        // Upgrade settings for WebSocket
        upgrade: true,
        rememberUpgrade: false,
        
        // Additional iOS-specific options
        jsonp: false,
        withCredentials: true,
        
        // Polling configuration for fallback
        pollingTimeout: 10000,
        
        // Auto-connect settings
        autoConnect: true
      };

      log(`Attempting connection to ${SERVER_URL} with iOS-optimized options...`);
      
      socketRef.current = io(SERVER_URL, socketOptions);
      
      setupSocketEvents();

      // iOS-specific connection monitoring
      const connectionTimeout = setTimeout(() => {
        if (connectionStatus === 'Connecting...' && socketRef.current) {
          log('Initial connection timeout, attempting polling-only fallback...');
          
          // Disconnect current attempt
          socketRef.current.disconnect();
          
          // Try polling-only mode for iOS
          socketRef.current = io(SERVER_URL, {
            ...socketOptions,
            transports: ['polling'], // Polling only
            timeout: 15000,
            reconnectionDelay: 1000
          });
          
          setupSocketEvents();
        }
      }, 8000);

      // Clear timeout on successful connection
      socketRef.current.on('connect', () => {
        clearTimeout(connectionTimeout);
      });

      // Enhanced error handling for iOS
      socketRef.current.on('connect_error', (error) => {
        clearTimeout(connectionTimeout);
        log(`Connection error: ${error.message || error.toString()}`);
        
        // iOS-specific error handling
        if (error.message?.includes('xhr poll error') || 
            error.message?.includes('websocket error')) {
          log('Detected iOS-specific connection error, will retry with different transport...');
          
          // Schedule retry with different configuration
          setTimeout(() => {
            if (connectionStatus !== 'Connected') {
              retryConnectionWithFallback();
            }
          }, 3000);
        }
      });

    } catch (error) {
      log(`Connection initialization error: ${error.message}`);
      setConnectionStatus('Connection Failed');
    }
  };

  // Fallback connection retry function for iOS
  const retryConnectionWithFallback = () => {
    log('Attempting fallback connection method for iOS...');
    
    if (socketRef.current) {
      socketRef.current.disconnect();
    }
    
    // Ultra-conservative settings for iOS
    const fallbackOptions = {
      transports: ['polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 3000,
      timeout: 20000,
      forceNew: true,
      secure: true,
      rejectUnauthorized: false,
      extraHeaders: {
        'Accept': '*/*',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    };
    
    socketRef.current = io(SERVER_URL, fallbackOptions);
    setupSocketEvents();
  };

  // Enhanced socket event setup with iOS considerations
  const setupSocketEvents = () => {
    detachSocketEvents();
    const socket = socketRef.current;

    socket.on('connect', () => {
      log('✅ Connected to signaling server successfully');
      setConnectionStatus('Connected');

      // Register device with additional iOS metadata
      const registrationData = {
        deviceId: role,
        platform: 'ios',
        version: Constants.expoConfig?.version || '1.0.0',
        buildNumber: Constants.expoConfig?.ios?.buildNumber || '7',
        timestamp: new Date().toISOString()
      };
      
      socket.emit('register', registrationData);
      log(`Registered as: ${role} with iOS metadata`);

      // Send heartbeat to maintain connection
      const heartbeatInterval = setInterval(() => {
        if (socket.connected) {
          socket.emit('ping', { timestamp: Date.now() });
        } else {
          clearInterval(heartbeatInterval);
        }
      }, 30000); // Every 30 seconds

      // Store interval for cleanup
      socket.heartbeatInterval = heartbeatInterval;
    });

    socket.on('connect_error', (error) => {
      log(`❌ Connection error: ${error.message || 'Unknown error'}`);
      log(`Error details: ${JSON.stringify(error)}`);
      setConnectionStatus('Connection Failed');
    });

    socket.on('disconnect', (reason) => {
      log(`❌ Disconnected: ${reason}`);
      setConnectionStatus('Disconnected');
      
      // Clear heartbeat interval
      if (socket.heartbeatInterval) {
        clearInterval(socket.heartbeatInterval);
        socket.heartbeatInterval = null;
      }
      
      if (callStatus !== 'idle') {
        endCall();
      }
    });

    // Add response to ping for connection health
    socket.on('pong', (data) => {
      log(`Connection health check: ${Date.now() - data.timestamp}ms`);
    });

    // Enhanced registration confirmation
    socket.on('registered', (data) => {
      log(`✅ Registration confirmed for ${data.deviceId} at ${data.timestamp}`);
    });

    socket.on('incomingCall', async (data) => {
      log(`Incoming call from: ${data.from} (Platform: ${data.callerPlatform || 'unknown'})`);
      
      // Only accept calls from our target or the other role
      if (data.from === targetId || (data.from !== role)) {
        setCallStatus('incoming');
        
        if (canAutoAnswer) {
          log('Auto-answering call...');
          await setupPeerConnection();
          await answerCall(data);
        } else {
          // Play a sound or vibration here in a real app
          
          Alert.alert(
            'Incoming Call',
            `Incoming call from ${data.from}. Answer?`,
            [
              {
                text: 'Decline',
                onPress: () => {
                  socket.emit('callRejected', { to: data.from });
                  setCallStatus('idle');
                },
                style: 'cancel',
              },
              {
                text: 'Answer',
                onPress: async () => {
                  await setupPeerConnection();
                  await answerCall(data);
                },
              },
            ],
            { cancelable: false }
          );
        }
      }
    });

    socket.on('callAccepted', async (data) => {
      log('Call accepted');
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallStatus('connected');
      } catch (error) {
        log(`Error setting remote description: ${error.message}`);
      }
    });

    socket.on('iceCandidate', async (data) => {
      log(`Received ICE candidate from: ${data.from}`);
      try {
        if (peerConnectionRef.current) {
          await peerConnectionRef.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        }
      } catch (error) {
        log(`Error adding ICE candidate: ${error.message}`);
      }
    });

    socket.on('callEnded', (data) => {
      log(`Call ended by: ${data.from}`);
      endCall();
    });

    socket.on('callRejected', (data) => {
      log(`Call rejected by: ${data.from}`);
      Alert.alert('Call Rejected', 'The other party rejected the call');
      endCall();
    });

    socket.on('callProgress', (data) => {
      log(`Call progress: ${data.status} to ${data.target}`);
    });

    socket.on('callError', (data) => {
      log(`Call error: ${data.message} (${data.code})`);
      Alert.alert('Call Error', data.message);
      setCallStatus('idle');
    });

    socket.on('userDisconnected', (data) => {
      log(`User disconnected: ${data.socketId} (${data.platform || 'unknown'}) - ${data.reason}`);
    });
  };

  // Set up WebRTC peer connection with enhanced TURN configuration
  const setupPeerConnection = async () => {
    await enumerateAndLogDevices(); // Log device info at connection start
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Enable speakerphone early
    if (speakerEnabled) {
      // Start the InCallManager to handle audio routing
      InCallManager.start({media: 'video'});
      enableSpeakerphone();
    }
    
    try {
      // Get user media with detailed logging
      log('Requesting camera and microphone access...');
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      log(`Media access granted: ${stream.getTracks().length} tracks`);
      stream.getTracks().forEach(track => {
        log(`Local track: ${track.kind} (id: ${track.id}, readyState: ${track.readyState}, enabled: ${track.enabled})`);
      });
      
      setLocalStream(stream);
      log('Local stream set');
      
      // Enhanced peer connection configuration with TURN servers
      const configuration = {
        iceServers: [
          // Primary TURN servers from environment
          ...((process.env.TURN_URLS || 'turn:api.justinmolds.com:3478?transport=udp,turn:api.justinmolds.com:3478?transport=tcp,turns:api.justinmolds.com:5349?transport=tcp').split(',').filter(Boolean).map(url => ({ 
            urls: url.trim(), 
            username: process.env.TURN_USERNAME || 'webrtcuser8888', 
            credential: process.env.TURN_PASSWORD || 'supersecret8888' 
          }))),
          // Fallback STUN servers
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ],
        // Enhanced ICE configuration for iOS
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all'
      };
      
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;
      log('Peer connection created with enhanced TURN configuration');
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
        log(`Added track to peer connection: ${track.kind}`);
      });
      
      // Handle remote stream
      pc.ontrack = (event) => {
        log(`Received remote track: ${event.track.kind} (${event.track.readyState})`);
        
        if (event.streams && event.streams[0]) {
          log(`Got remote stream with ${event.streams[0].getTracks().length} tracks`);
          event.streams[0].getTracks().forEach(track => {
            log(`Remote track: ${track.kind} (id: ${track.id}, readyState: ${track.readyState}, enabled: ${track.enabled})`);
          });

          setRemoteStream(event.streams[0]);
          log('Remote stream set');

          // Attach to video element and add playback event listeners
          setTimeout(() => {
            if (remoteVideoRef.current) {
              remoteVideoRef.current.srcObject = event.streams[0];
              remoteVideoRef.current.onloadedmetadata = () => {
                log('Remote video metadata loaded');
                remoteVideoRef.current.play()
                  .then(() => log('Remote video playing'))
                  .catch(e => log('Remote video play() failed: ' + e.message));
              };
              remoteVideoRef.current.onplaying = () => {
                log('Remote video is actually playing');
              };
              remoteVideoRef.current.onerror = (e) => {
                log('Remote video error: ' + (e && e.message ? e.message : 'unknown error'));
              };
            } else {
              log('Remote video ref not available for playback events');
            }
          }, 250);
        } else {
          log('WARNING: Received track but no streams array');
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log(`Generated ICE candidate for: ${targetId}`);
          socketRef.current.emit('iceCandidate', {
            to: targetId,
            candidate: event.candidate
          });
        }
      };
      
      // Log ICE gathering state changes
      pc.onicegatheringstatechange = () => {
        log(`ICE gathering state: ${pc.iceGatheringState}`);
      };
      
      // Handle connection state changes
      pc.oniceconnectionstatechange = () => {
        log(`ICE connection state: ${pc.iceConnectionState}`);
        
        if (pc.iceConnectionState === 'connected') {
          log('ICE connection established!');
          setCallStatus('connected');
        } else if (
          pc.iceConnectionState === 'disconnected' || 
          pc.iceConnectionState === 'failed'
        ) {
          log('ICE connection failed or disconnected');
          endCall();
        }
      };
      
      // Handle signaling state changes
      pc.onsignalingstatechange = () => {
        log(`Signaling state: ${pc.signalingState}`);
      };
      
      log('Peer connection setup complete');
      return true;
    } catch (error) {
      log(`Media error: ${error.message}`);
      Alert.alert('Error', 'Could not access camera or microphone: ' + error.message);
      return false;
    }
  };

  // Start a call
  const startCall = async () => {
    if (connectionStatus !== 'Connected') {
      log('Not connected to signaling server');
      Alert.alert('Connection Error', 'Not connected to signaling server');
      return;
    }

    log(`Starting call to: ${targetId}`);
    setCallStatus('calling');
    
    try {
      const success = await setupPeerConnection();
      
      if (!success) {
        setCallStatus('idle');
        return;
      }
      
      // Create offer
      log('Creating offer...');
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      log('Setting local description...');
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send offer to signaling server
      log(`Sending offer to: ${targetId}`);
      socketRef.current.emit('makeCall', {
        to: targetId,
        offer,
      });
    } catch (error) {
      log(`Error starting call: ${error.message}`);
      Alert.alert('Call Failed', 'Failed to start call: ' + error.message);
      setCallStatus('idle');
    }
  };

  // Answer an incoming call
  const answerCall = async (data) => {
    try {
      log('Setting remote description from offer...');
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
      
      // Create answer
      log('Creating answer...');
      const answer = await peerConnectionRef.current.createAnswer();
      
      log('Setting local description from answer...');
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send answer to signaling server
      log(`Sending answer to: ${data.from}`);
      socketRef.current.emit('answerCall', {
        to: data.from,
        answer,
      });
      
      setCallStatus('connected');
    } catch (error) {
      log(`Error answering call: ${error.message}`);
      Alert.alert('Call Failed', 'Failed to answer call: ' + error.message);
      setCallStatus('idle');
    }
  };

  // End the current call
  const endCall = () => {
    log('Ending call...');
    setCallStatus('idle');
    
    if (socketRef.current) {
      socketRef.current.emit('endCall', { to: targetId });
    }
    
    // Stop the InCallManager when call ends
    InCallManager.stop();
    
    cleanupWebRTC();
  };

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    // Stop local stream tracks
    if (localStream) {
      log('Stopping local tracks...');
      localStream.getTracks().forEach(track => {
        log(`Stopping local track: ${track.kind}`);
        track.stop();
      });
      setLocalStream(null);
    }

    // Stop remote stream tracks
    if (remoteStream) {
      log('Cleaning up remote stream...');
      remoteStream.getTracks().forEach(track => {
        log(`Stopping remote track: ${track.kind}`);
        track.stop();
      });
      setRemoteStream(null);
    }

    // Clean up peer connection and remove all event handlers
    if (peerConnectionRef.current) {
      log('Closing peer connection and removing event handlers');
      try {
        peerConnectionRef.current.onicecandidate = null;
        peerConnectionRef.current.ontrack = null;
        peerConnectionRef.current.oniceconnectionstatechange = null;
        peerConnectionRef.current.onicegatheringstatechange = null;
        peerConnectionRef.current.onsignalingstatechange = null;
        peerConnectionRef.current.onnegotiationneeded = null;
        peerConnectionRef.current.onconnectionstatechange = null;
      } catch (e) {
        log('Error detaching peer connection handlers: ' + e.message);
      }
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Optionally clear video element srcObject
    if (remoteVideoRef && remoteVideoRef.current) {
      try {
        remoteVideoRef.current.srcObject = null;
        log('Cleared remote video srcObject');
      } catch (e) {
        log('Error clearing remote video srcObject: ' + e.message);
      }
    }

    log('Cleanup complete. All streams and peer connections reset.');
  };

  // Helper to remove all socket event listeners before reattaching
  const detachSocketEvents = () => {
    const socket = socketRef.current;
    if (!socket) return;
    socket.off('connect');
    socket.off('connect_error');
    socket.off('disconnect');
    socket.off('incomingCall');
    socket.off('callAccepted');
    socket.off('iceCandidate');
    socket.off('callEnded');
    socket.off('callRejected');
    socket.off('registered');
    socket.off('callProgress');
    socket.off('callError');
    socket.off('userDisconnected');
    socket.off('pong');
  };

  // Toggle auto-answer setting
  const toggleAutoAnswer = () => {
    setCanAutoAnswer(!canAutoAnswer);
    log(`Auto-answer ${!canAutoAnswer ? 'enabled' : 'disabled'}`);
  };

  // Save role to AsyncStorage whenever it changes
  useEffect(() => {
    const saveRole = async () => {
      try {
        await AsyncStorage.setItem('selectedRole', role);
        log(`Role saved: ${role}`);
      } catch (e) {
        log(`Error saving role: ${e.message}`);
      }
    };
    saveRole();
  }, [role]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1B2631" />
      
      {/* Role Selector Header - Very Prominent */}
      <View style={styles.headerContainer}>
        <Text style={styles.headerText}>WEBRTC TESTER v{buildNumber}</Text>
        {updateAvailable && (
          <TouchableOpacity 
            style={styles.updateButton}
            onPress={async () => {
              try {
                await Updates.reloadAsync();
              } catch (error) {
                log(`Error applying update: ${error.message}`);
              }
            }}
          >
            <Text style={styles.updateButtonText}>APPLY UPDATE</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.settingsContainer}>
        <TouchableOpacity
          style={[styles.settingButton, canAutoAnswer ? styles.settingEnabled : styles.settingDisabled]}
          onPress={() => setCanAutoAnswer(!canAutoAnswer)}
        >
          <Text style={styles.settingButtonText}>
            {canAutoAnswer ? "Auto-Answer: ON" : "Auto-Answer: OFF"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.settingButton, speakerEnabled ? styles.settingEnabled : styles.settingDisabled]}
          onPress={() => {
            const newValue = !speakerEnabled;
            setSpeakerEnabled(newValue);
            if (callStatus === 'connected') {
              if (newValue) {
                enableSpeakerphone();
              } else {
                disableSpeakerphone();
              }
            }
            log(`Speakerphone set to: ${newValue ? 'ON' : 'OFF'}`);
          }}
        >
          <Text style={styles.settingButtonText}>
            {speakerEnabled ? "Speakerphone: ON" : "Speakerphone: OFF"}
          </Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.statusContainer}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Server:</Text>
          <Text style={[
            styles.statusValue,
            connectionStatus === 'Connected' ? styles.connectedStatus : styles.disconnectedStatus
          ]}>
            {connectionStatus}
          </Text>
        </View>
        
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Call Status:</Text>
          <Text style={[
            styles.statusValue,
            callStatus === 'idle' ? styles.idleStatus :
            callStatus === 'calling' ? styles.callingStatus :
            callStatus === 'connected' ? styles.connectedStatus : styles.disconnectedStatus
          ]}>
            {callStatus === 'idle' ? 'Ready' :
             callStatus === 'calling' ? 'Calling...' :
             callStatus === 'incoming' ? 'Incoming Call' : 'Connected'}
          </Text>
        </View>
      </View>
      
      <View style={styles.videoContainer}>
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}
        
        {localStream && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            zOrder={1}
          />
        )}
        
        {!remoteStream && !localStream && (
          <View style={styles.noVideoPlaceholder}>
            <Text style={styles.placeholderText}>
              {callStatus === 'idle' ? 'No active call' : 
               callStatus === 'calling' ? 'Calling...' : 'Connecting...'}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controlsContainer}>
        {callStatus === 'idle' ? (
          <TouchableOpacity
            style={[styles.button, styles.callButton, connectionStatus !== 'Connected' && styles.disabledButton]}
            onPress={startCall}
            disabled={connectionStatus !== 'Connected'}
          >
            <Text style={styles.buttonText}>Call {role === 'bills-iphone' ? 'Family' : 'Bill'}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.endButton]}
            onPress={endCall}
          >
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        )}
        
        <TouchableOpacity
          style={[styles.button, styles.reconnectButton]}
          onPress={connectToSignalingServer}
        >
          <Text style={styles.buttonText}>Reconnect</Text>
        </TouchableOpacity>
      </View>
      
      <View style={styles.logContainer}>
        <View style={styles.logHeader}>
          <Text style={styles.logHeaderText}>Connection Logs:</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={shareLogs}
          >
            <Text style={styles.shareButtonText}>Share Logs</Text>
          </TouchableOpacity>
        </View>
        <ScrollView 
          style={styles.logScroll}
          ref={(ref) => { this.scrollView = ref; }}
          onContentSizeChange={() => {
            this.scrollView && this.scrollView.scrollToEnd({ animated: true });
          }}
        >
          {logs.map((entry, index) => (
            <Text key={index} style={styles.logEntry}>{entry}</Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1B2631',
  },
  headerContainer: {
    backgroundColor: '#673AB7',
    paddingVertical: 12,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  updateButton: {
    backgroundColor: '#4CAF50',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 15,
    marginLeft: 10,
  },
  updateButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 12,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  roleSelectorBanner: {
    backgroundColor: '#FF5722',
    padding: 15,
    marginVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roleBannerText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
    flex: 1,
  },
  changeRoleButton: {
    backgroundColor: 'white',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
  },
  changeRoleButtonText: {
    color: '#FF5722',
    fontWeight: 'bold',
    fontSize: 14,
  },
  settingsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 15,
    marginBottom: 5,
  },
  statusContainer: {
    marginHorizontal: 20,
    marginBottom: 15,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 14,
    color: 'white',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  connectedStatus: {
    color: '#4CAF50',
  },
  disconnectedStatus: {
    color: '#F44336',
  },
  idleStatus: {
    color: '#757575',
  },
  callingStatus: {
    color: '#FFC107',
  },
  videoContainer: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
    margin: 15,
    backgroundColor: '#2C3E50',
  },
  remoteVideo: {
    flex: 1,
  },
  localVideo: {
    position: 'absolute',
    width: 100,
    height: 150,
    bottom: 10,
    right: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  noVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    padding: 20,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    minWidth: 120,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  reconnectButton: {
    backgroundColor: '#2196F3',
  },
  disabledButton: {
    backgroundColor: '#555',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  settingButton: {
    marginHorizontal: 5,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 5,
    flex: 1,
  },
  settingEnabled: {
    backgroundColor: '#673AB7',
  },
  settingDisabled: {
    backgroundColor: '#455A64',
  },
  settingButtonText: {
    color: 'white',
    fontSize: 14,
  },
  logContainer: {
    marginHorizontal: 10,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    marginBottom: 5,
    padding: 8,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 5,
  },
  logHeaderText: {
    color: 'white',
    fontSize: 14,
  },
  shareButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  shareButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  logScroll: {
    flex: 1,
  },
  logEntry: {
    color: '#ccc',
    fontSize: 11,
    fontFamily: 'monospace',
    marginBottom: 1,
  },
});

export default WebRTCRoleTester;
      
      {/* Role Selector - Made More Visible */}
      <View style={styles.roleSelectorBanner}>
        <Text style={styles.roleBannerText}>
          Current Role: {role === 'bills-iphone' ? "BILL'S PHONE" : "FAMILY CALLER"}
        </Text>
        <TouchableOpacity 
          style={styles.changeRoleButton}
          onPress={() => {
            // Toggle role when pressed
            const newRole = role === 'bills-iphone' ? 'family-caller' : 'bills-iphone';
            handleRoleChange(newRole);
          }}
        >
          <Text style={styles.changeRoleButtonText}>CHANGE ROLE</Text>
        </TouchableOpacity>
      </View>