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
  const [canAutoAnswer, setCanAutoAnswer] = useState(role === 'bills-iphone');
  const [speakerEnabled, setSpeakerEnabled] = useState(true);

  // Constants
  const SERVER_URL = 'http://143.198.180.248:3000';

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
      }
      cleanupWebRTC();
    };
  }, [role]);

  // Logging function
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    console.log(logEntry);
    logsRef.current = [...logsRef.current, logEntry];
    setLogs([...logsRef.current]);
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
      const deviceInfo = `Device: ${Platform.OS} ${Platform.Version}\n` +
                        `Role: ${role}\n` +
                        `Target: ${targetId}\n` +
                        `Connection: ${connectionStatus}\n` +
                        `Call Status: ${callStatus}\n\n`;
                        
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

  // Connect to signaling server
  const connectToSignalingServer = () => {
    log(`Connecting to signaling server as ${role}...`);
    setConnectionStatus('Connecting...');

    try {
      // Try both websocket and polling
      socketRef.current = io(SERVER_URL, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      setupSocketEvents();

      // Fallback to polling if websocket fails
      setTimeout(() => {
        if (connectionStatus === 'Connecting...' && socketRef.current) {
          log('Connection not established, trying polling transport only...');
          socketRef.current.disconnect();
          
          socketRef.current = io(SERVER_URL, {
            transports: ['polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
          });
          
          setupSocketEvents();
        }
      }, 5000);
    } catch (error) {
      log(`Connection error: ${error.message}`);
      setConnectionStatus('Connection Failed');
    }
  };

  // Setup socket event handlers
  const setupSocketEvents = () => {
    const socket = socketRef.current;

    socket.on('connect', () => {
      log('Connected to signaling server');
      setConnectionStatus('Connected');

      // Register device ID
      socket.emit('register', { deviceId: role });
      log(`Registered as: ${role}, targeting: ${targetId}`);

      // Send a second registration after a delay (helps with stability)
      setTimeout(() => {
        socket.emit('register', { deviceId: role });
        log('Re-registered to ensure connection');
      }, 1000);
    });

    socket.on('connect_error', (error) => {
      log(`Connection error: ${error.message || 'Unknown error'}`);
      setConnectionStatus('Connection Failed');
    });

    socket.on('disconnect', (reason) => {
      log(`Disconnected: ${reason}`);
      setConnectionStatus('Disconnected');
      if (callStatus !== 'idle') {
        endCall();
      }
    });

    socket.on('incomingCall', async (data) => {
      log(`Incoming call from: ${data.from}`);
      
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
  };

  // Set up WebRTC peer connection
  const setupPeerConnection = async () => {
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
        log(`Local track: ${track.kind} (${track.readyState})`);
      });
      
      setLocalStream(stream);
      log('Local stream set');
      
      // Create peer connection
      const configuration = {
        iceServers: [
  ...((process.env.TURN_URLS || '').split(',').filter(Boolean).map(url => ({ urls: url.trim(), username: process.env.TURN_USERNAME || 'webrtcuser88', credential: process.env.TURN_PASSWORD || 'supersecret88' }))),
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
]
      };
      
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;
      log('Peer connection created');
      
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
            log(`Remote track: ${track.kind} (${track.readyState}) - active: ${track.enabled}`);
          });
          
          setRemoteStream(event.streams[0]);
          log('Remote stream set');
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
    if (localStream) {
      log('Stopping local tracks...');
      localStream.getTracks().forEach(track => {
        log(`Stopping local track: ${track.kind}`);
        track.stop();
      });
      setLocalStream(null);
    }
    
    if (peerConnectionRef.current) {
      log('Closing peer connection');
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    if (remoteStream) {
      log('Cleaning up remote stream...');
      remoteStream.getTracks().forEach(track => {
        log(`Stopping remote track: ${track.kind}`);
        track.stop();
      });
      setRemoteStream(null);
    }
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

  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          setUpdateAvailable(true);
        }
      } catch (error) {
        log(`Error checking for updates: ${error.message}`);
      }
    };
    checkForUpdates();
  }, []);

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
            setRole(newRole);
            updateTargetId(newRole);
          }}
        >
          <Text style={styles.changeRoleButtonText}>CHANGE ROLE</Text>
        </TouchableOpacity>
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
