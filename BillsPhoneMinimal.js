import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';
import io from 'socket.io-client';

/**
 * BillsPhoneMinimal
 * 
 * A simplified version of Bill's Phone app that focuses only on basic WebRTC functionality.
 * This app uses the 'bills-iphone' device ID to match the expected ID from family callers.
 * It has a very basic UI with large buttons for easy testing.
 */
const BillsPhoneMinimal = () => {
  // State
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, calling, connected
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [logs, setLogs] = useState([]);
  const [canAutoAnswer, setCanAutoAnswer] = useState(false);

  // Constants
  const SERVER_URL = 'https://api.justinmolds.com';
  const MY_ID = 'bills-iphone';
  const TARGET_ID = 'family-caller';

  // Refs
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const logsRef = useRef([]);

  // Logging function
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    console.log(logEntry);
    logsRef.current = [...logsRef.current, logEntry];
    setLogs([...logsRef.current]);
  };

  // Initialize socket connection
  useEffect(() => {
    connectToSignalingServer();

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
      cleanupWebRTC();
    };
  }, []);

  // Connect to signaling server
  const connectToSignalingServer = () => {
    log('Connecting to signaling server...');
    setConnectionStatus('Connecting...');

    try {
      // Try both transport types with WebSocket first
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
      socket.emit('register', { deviceId: MY_ID });
      log(`Registered as: ${MY_ID}`);

      // Send a second registration after a delay (helps with stability)
      setTimeout(() => {
        socket.emit('register', { deviceId: MY_ID });
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
      
      if (data.from === TARGET_ID) {
        setCallStatus('incoming');
        
        if (canAutoAnswer) {
          log('Auto-answering call...');
          await setupPeerConnection();
          await answerCall(data);
        } else {
          // Play a sound or vibration here in a real app
          
          Alert.alert(
            'Incoming Call',
            `Family member is calling. Answer?`,
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
      Alert.alert('Call Rejected', 'Family member rejected the call');
      endCall();
    });
  };

  // Set up WebRTC peer connection
  const setupPeerConnection = async () => {
    try {
      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      setLocalStream(stream);
      
      // Create peer connection
      const configuration = {
        iceServers: [
  ...((process.env.TURN_URLS || '').split(',').filter(Boolean).map(url => ({ urls: url.trim(), username: process.env.TURN_USERNAME || 'webrtcuser8888', credential: process.env.TURN_PASSWORD || 'supersecret8888' }))),
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' }
]
      };
      
      const pc = new RTCPeerConnection(configuration);
      peerConnectionRef.current = pc;
      
      // Add local stream to peer connection
      stream.getTracks().forEach(track => {
        pc.addTrack(track, stream);
      });
      
      // Handle remote stream
      pc.ontrack = (event) => {
        log('Received remote track');
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log('Sending ICE candidate');
          socketRef.current.emit('iceCandidate', {
            to: TARGET_ID,
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      pc.oniceconnectionstatechange = () => {
        log(`ICE connection state: ${pc.iceConnectionState}`);
        
        if (pc.iceConnectionState === 'connected') {
          setCallStatus('connected');
        } else if (
          pc.iceConnectionState === 'disconnected' || 
          pc.iceConnectionState === 'failed'
        ) {
          endCall();
        }
      };
      
      return true;
    } catch (error) {
      log(`Media error: ${error.message}`);
      Alert.alert('Error', 'Could not access camera or microphone');
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

    log(`Starting call to family (${TARGET_ID})`);
    setCallStatus('calling');
    
    try {
      const success = await setupPeerConnection();
      
      if (!success) {
        setCallStatus('idle');
        return;
      }
      
      // Create offer
      const offer = await peerConnectionRef.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send offer to signaling server
      socketRef.current.emit('makeCall', {
        to: TARGET_ID,
        offer,
      });
    } catch (error) {
      log(`Error starting call: ${error.message}`);
      Alert.alert('Call Failed', 'Failed to start call');
      setCallStatus('idle');
    }
  };

  // Answer an incoming call
  const answerCall = async (data) => {
    try {
      await peerConnectionRef.current.setRemoteDescription(
        new RTCSessionDescription(data.offer)
      );
      
      // Create answer
      const answer = await peerConnectionRef.current.createAnswer();
      await peerConnectionRef.current.setLocalDescription(answer);
      
      // Send answer to signaling server
      socketRef.current.emit('answerCall', {
        to: data.from,
        answer,
      });
      
      setCallStatus('connected');
    } catch (error) {
      log(`Error answering call: ${error.message}`);
      Alert.alert('Call Failed', 'Failed to answer call');
      setCallStatus('idle');
    }
  };

  // End the current call
  const endCall = () => {
    log('Ending call');
    
    if (socketRef.current && callStatus !== 'idle') {
      socketRef.current.emit('endCall', {
        to: TARGET_ID,
      });
    }
    
    cleanupWebRTC();
    setCallStatus('idle');
  };

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    setRemoteStream(null);
  };

  // Toggle auto-answer setting
  const toggleAutoAnswer = () => {
    setCanAutoAnswer(!canAutoAnswer);
    log(`Auto-answer ${!canAutoAnswer ? 'enabled' : 'disabled'}`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Bill's Phone - Minimal</Text>
        <Text style={styles.subtitle}>Testing Version</Text>
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Connection:</Text>
        <Text style={[
          styles.statusValue,
          connectionStatus === 'Connected' ? styles.connectedStatus : styles.disconnectedStatus
        ]}>
          {connectionStatus}
        </Text>
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.statusLabel}>Call Status:</Text>
        <Text style={[
          styles.statusValue,
          callStatus === 'idle' ? styles.idleStatus :
          callStatus === 'calling' ? styles.callingStatus :
          callStatus === 'connected' ? styles.connectedStatus : styles.disconnectedStatus
        ]}>
          {callStatus === 'idle' ? 'Ready' :
           callStatus === 'calling' ? 'Calling Family' :
           callStatus === 'incoming' ? 'Family is Calling' : 'Connected to Family'}
        </Text>
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
               callStatus === 'calling' ? 'Calling Family...' : 'Connecting...'}
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.controlsContainer}>
        {callStatus === 'idle' ? (
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={startCall}
            disabled={connectionStatus !== 'Connected'}
          >
            <Text style={styles.buttonText}>Call Family</Text>
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
      
      <TouchableOpacity
        style={[
          styles.settingButton,
          canAutoAnswer ? styles.settingEnabled : styles.settingDisabled
        ]}
        onPress={toggleAutoAnswer}
      >
        <Text style={styles.settingButtonText}>
          Auto-Answer: {canAutoAnswer ? 'ON' : 'OFF'}
        </Text>
      </TouchableOpacity>
      
      <View style={styles.logContainer}>
        {logs.slice(-5).map((entry, index) => (
          <Text key={index} style={styles.logEntry}>{entry}</Text>
        ))}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
    marginTop: 5,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statusLabel: {
    fontSize: 18,
    color: 'white',
    marginRight: 10,
  },
  statusValue: {
    fontSize: 18,
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
    width: 120,
    height: 160,
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
    padding: 15,
  },
  button: {
    paddingVertical: 20,
    paddingHorizontal: 40,
    borderRadius: 40,
    minWidth: 180,
    alignItems: 'center',
    marginHorizontal: 10,
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
  buttonText: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  settingButton: {
    marginHorizontal: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 10,
  },
  settingEnabled: {
    backgroundColor: '#673AB7',
  },
  settingDisabled: {
    backgroundColor: '#455A64',
  },
  settingButtonText: {
    color: 'white',
    fontSize: 16,
  },
  logContainer: {
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  logEntry: {
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default BillsPhoneMinimal;
