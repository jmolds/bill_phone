import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Button,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  SafeAreaView,
  Picker,
  Platform
} from 'react-native';
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription, RTCView, mediaDevices } from 'react-native-webrtc';
import io from 'socket.io-client';

/**
 * WebRTCTester
 * 
 * A simplified tester component for WebRTC functionality in Bill's Phone app.
 * This component matches the functionality of the web-tester to ensure
 * compatibility and connection between devices.
 */
const WebRTCTester = () => {
  // State variables
  const [serverUrl, setServerUrl] = useState('http://143.198.180.248:3000');
  const [deviceRole, setDeviceRole] = useState('bills-iphone');
  const [targetId, setTargetId] = useState('family-caller');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [callStatus, setCallStatus] = useState('Idle');
  const [logs, setLogs] = useState([]);

  // Refs for WebRTC
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const isConnectedRef = useRef(false);
  const isInCallRef = useRef(false);

  // Add log entry
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    console.log(logEntry);
    setLogs(prevLogs => [...prevLogs, logEntry]);
  };

  // Update device role and target ID
  const updateDeviceId = (role) => {
    setDeviceRole(role);
    // Set target ID to the opposite role
    setTargetId(role === 'bills-iphone' ? 'family-caller' : 'bills-iphone');
    log(`Role changed to: ${role}`);
  };

  // Setup socket events
  const setupSocketEvents = () => {
    const socket = socketRef.current;
    
    socket.on('connect', () => {
      isConnectedRef.current = true;
      setConnectionStatus('Connected');
      log('Connected to signaling server');
      
      // Register with the server using our simple ID
      setTimeout(() => {
        socket.emit('register', { deviceId: deviceRole });
        log(`Registered as: ${deviceRole}`);
        
        // Send a second registration after a short delay (helps with mobile browser issues)
        setTimeout(() => {
          socket.emit('register', { deviceId: deviceRole });
          log(`Re-registered as: ${deviceRole}`);
        }, 1000);
      }, 500);
    });

    socket.on('connect_error', (error) => {
      log(`Connection error: ${error}`);
      isConnectedRef.current = false;
      setConnectionStatus('Connection Failed');
    });

    socket.on('disconnect', (reason) => {
      log(`Disconnected: ${reason}`);
      isConnectedRef.current = false;
      setConnectionStatus('Disconnected');
      
      if (isInCallRef.current) {
        endCall();
      }
    });

    socket.on('incomingCall', async (data) => {
      log(`Incoming call from: ${data.from}`);
      setCallStatus('Incoming Call');
      
      Alert.alert(
        'Incoming Call',
        `Incoming call from ${data.from}. Accept?`,
        [
          {
            text: 'Decline',
            onPress: () => {
              socket.emit('callRejected', { to: data.from });
            },
            style: 'cancel',
          },
          {
            text: 'Accept',
            onPress: async () => {
              await setupPeerConnection();
              await answerCall(data);
            },
          },
        ]
      );
    });

    socket.on('callAccepted', async (data) => {
      log('Call accepted');
      try {
        await peerConnectionRef.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallStatus('Connected');
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
      endCall();
      Alert.alert('Call Rejected', 'The call was rejected');
    });

    socket.on('callError', (data) => {
      log(`Call error: ${data.message}`);
      Alert.alert('Call Error', data.message);
      endCall();
    });
  };

  // Connect to signaling server
  const connectToSignalingServer = () => {
    log(`Connecting to signaling server: ${serverUrl}`);
    setConnectionStatus('Connecting...');
    
    try {
      // Close any existing socket
      if (socketRef.current) {
        socketRef.current.close();
      }
      
      socketRef.current = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 10000
      });
      
      setupSocketEvents();
      
      // Auto-reconnect if connection fails within 5 seconds
      setTimeout(() => {
        if (!isConnectedRef.current) {
          log('Connection timeout - trying polling transport');
          socketRef.current.close();
          socketRef.current = io(serverUrl, {
            transports: ['polling'],
            reconnection: true
          });
          setupSocketEvents();
        }
      }, 5000);
    } catch (error) {
      log(`Connection error: ${error.message}`);
      setConnectionStatus('Connection Failed');
    }
  };

  // Setup peer connection
  const setupPeerConnection = async () => {
    log('Setting up peer connection');
    
    try {
      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: true
      });
      
      localStreamRef.current = stream;
      
      // Create peer connection
      const configuration = {
        iceServers: [
  ...((process.env.TURN_URLS || '').split(',').filter(Boolean).map(url => ({ urls: url.trim(), username: process.env.TURN_USERNAME || 'webrtcuser8888', credential: process.env.TURN_PASSWORD || 'supersecret8888' }))),
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
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
          remoteStreamRef.current = event.streams[0];
        }
      };
      
      // Handle ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          log('Sending ICE candidate');
          socketRef.current.emit('iceCandidate', {
            to: targetId,
            candidate: event.candidate
          });
        }
      };
      
      // Handle connection state changes
      pc.oniceconnectionstatechange = () => {
        log(`ICE connection state: ${pc.iceConnectionState}`);
        
        if (pc.iceConnectionState === 'connected') {
          setCallStatus('Connected');
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
      Alert.alert(
        'Media Error',
        `Could not access camera or microphone: ${error.message}`
      );
      return false;
    }
  };

  // Start a call
  const startCall = async () => {
    if (!isConnectedRef.current) {
      connectToSignalingServer();
      return;
    }

    log(`Starting call to: ${targetId}`);
    setCallStatus('Calling...');
    isInCallRef.current = true;
    
    try {
      const success = await setupPeerConnection();
      
      if (!success) {
        endCall();
        return;
      }
      
      // Create offer
      const offer = await peerConnectionRef.current.createOffer();
      await peerConnectionRef.current.setLocalDescription(offer);
      
      // Send offer to signaling server
      socketRef.current.emit('makeCall', {
        to: targetId,
        offer: peerConnectionRef.current.localDescription
      });
    } catch (error) {
      log(`Error starting call: ${error.message}`);
      endCall();
      Alert.alert('Call Failed', 'Failed to start call');
    }
  };

  // Answer call
  const answerCall = async (data) => {
    log(`Answering call from: ${data.from}`);
    setTargetId(data.from);
    setCallStatus('Answering...');
    isInCallRef.current = true;
    
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
        answer: peerConnectionRef.current.localDescription
      });
      
      setCallStatus('Connected');
    } catch (error) {
      log(`Error answering call: ${error.message}`);
      endCall();
      Alert.alert('Call Failed', 'Failed to answer call');
    }
  };

  // End call
  const endCall = () => {
    log('Ending call');
    setCallStatus('Idle');
    isInCallRef.current = false;
    
    // Send end call signal if in a call
    if (targetId && isConnectedRef.current && socketRef.current) {
      socketRef.current.emit('endCall', { to: targetId });
    }
    
    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Clear remote stream
    remoteStreamRef.current = null;
  };

  // Initialize
  useEffect(() => {
    log('WebRTC tester initialized');
    
    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      endCall();
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Bill's Phone WebRTC Tester</Text>
      
      <View style={styles.controlPanel}>
        <Text style={styles.label}>Server URL:</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
        />

        <Text style={styles.label}>Device Role:</Text>
        <View style={styles.pickerContainer}>
          {Platform.OS === 'ios' ? (
            <Picker
              selectedValue={deviceRole}
              onValueChange={updateDeviceId}
              style={styles.picker}
            >
              <Picker.Item label="Bill's Phone" value="bills-iphone" />
              <Picker.Item label="Family Caller" value="family-caller" />
            </Picker>
          ) : (
            <Picker
              selectedValue={deviceRole}
              onValueChange={updateDeviceId}
              style={styles.picker}
            >
              <Picker.Item label="Bill's Phone" value="bills-iphone" />
              <Picker.Item label="Family Caller" value="family-caller" />
            </Picker>
          )}
        </View>

        <Text style={styles.label}>Target Device:</Text>
        <Text style={styles.targetText}>{targetId}</Text>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Connection:</Text>
          <Text style={styles.statusText}>{connectionStatus}</Text>
        </View>
        
        <View style={styles.statusContainer}>
          <Text style={styles.statusLabel}>Call Status:</Text>
          <Text style={styles.statusText}>{callStatus}</Text>
        </View>
      </View>
      
      <View style={styles.videoContainer}>
        {remoteStreamRef.current && (
          <RTCView
            streamURL={remoteStreamRef.current.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}
        
        {localStreamRef.current && (
          <RTCView
            streamURL={localStreamRef.current.toURL()}
            style={styles.localVideo}
            objectFit="cover"
            zOrder={1}
          />
        )}
      </View>
      
      <View style={styles.buttonContainer}>
        {callStatus === 'Idle' ? (
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>
              {isConnectedRef.current ? 'Start Call' : 'Connect & Call'}
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, styles.endButton]}
            onPress={endCall}
          >
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.logContainer}>
        <Text style={styles.logHeader}>Logs:</Text>
        <ScrollView style={styles.logScroll}>
          {logs.map((log, index) => (
            <Text key={index} style={styles.logEntry}>{log}</Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 10,
  },
  header: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginVertical: 10,
  },
  controlPanel: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  label: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    color: 'white',
    padding: 8,
    borderRadius: 5,
    marginBottom: 10,
  },
  pickerContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 5,
    marginBottom: 10,
  },
  picker: {
    color: 'white',
    height: 50,
  },
  targetText: {
    color: '#4CAF50',
    fontSize: 16,
    marginBottom: 10,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  statusLabel: {
    color: 'white',
    fontSize: 16,
    marginRight: 5,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 16,
  },
  videoContainer: {
    flex: 1,
    backgroundColor: '#2C3E50',
    borderRadius: 10,
    marginBottom: 10,
    position: 'relative',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: 'black',
    borderRadius: 10,
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
  buttonContainer: {
    marginBottom: 10,
  },
  button: {
    padding: 15,
    borderRadius: 50,
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  endButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  logContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 10,
    padding: 10,
    height: 150,
  },
  logHeader: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  logScroll: {
    flex: 1,
  },
  logEntry: {
    color: '#CCC',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 2,
  },
});

export default WebRTCTester;
