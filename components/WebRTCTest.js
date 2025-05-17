import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  PermissionsAndroid,
  Alert,
} from 'react-native';
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  mediaDevices,
  RTCView,
} from 'react-native-webrtc';
import io from 'socket.io-client';

// Use a variable for the signaling server URL so it's easy to change
const SIGNALING_SERVER_URL = 'http://YOUR_SERVER:3000';

const WebRTCTest = () => {
  // State variables
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCalling, setIsCalling] = useState(false);
  const [deviceId, setDeviceId] = useState('');
  const [targetDeviceId, setTargetDeviceId] = useState('');
  const [callStatus, setCallStatus] = useState('disconnected'); // disconnected, connecting, connected

  // Refs
  const peerConnection = useRef(null);
  const socket = useRef(null);

  // Generate a simple device ID (in a real app, use a persistent ID)
  useEffect(() => {
    const id = Math.floor(Math.random() * 1000000).toString();
    setDeviceId(id);
    setTargetDeviceId(id === '123456' ? '654321' : '123456'); // Simple test logic
  }, []);

  // Initialize socket connection
  useEffect(() => {
    console.log('Connecting to signaling server:', SIGNALING_SERVER_URL);
    
    socket.current = io(SIGNALING_SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    });

    // Socket event listeners
    socket.current.on('connect', () => {
      console.log('Connected to signaling server with ID:', deviceId);
      socket.current.emit('register', { deviceId });
    });

    socket.current.on('connect_error', (err) => {
      console.error('Connection error:', err);
      setCallStatus('disconnected');
      Alert.alert('Connection Error', 'Could not connect to signaling server');
    });

    socket.current.on('offer', async (data) => {
      console.log('Received offer from:', data.from);
      if (!peerConnection.current) {
        await setupPeerConnection();
      }
      
      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.offer)
        );
        
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        
        socket.current.emit('answer', {
          to: data.from,
          answer: peerConnection.current.localDescription
        });
        
        setCallStatus('connecting');
        Alert.alert('Incoming Call', 'Answering call automatically in test mode');
      } catch (err) {
        console.error('Error handling offer:', err);
      }
    });

    socket.current.on('answer', async (data) => {
      console.log('Received answer from:', data.from);
      try {
        await peerConnection.current.setRemoteDescription(
          new RTCSessionDescription(data.answer)
        );
        setCallStatus('connecting');
      } catch (err) {
        console.error('Error handling answer:', err);
      }
    });

    socket.current.on('ice-candidate', async (data) => {
      if (peerConnection.current) {
        try {
          await peerConnection.current.addIceCandidate(
            new RTCIceCandidate(data.candidate)
          );
        } catch (err) {
          console.error('Error adding ICE candidate:', err);
        }
      }
    });

    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [deviceId]);

  // Request permissions for camera and microphone
  const getPermissions = async () => {
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.CAMERA,
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      ]);
      
      return (
        granted[PermissionsAndroid.PERMISSIONS.CAMERA] === 'granted' &&
        granted[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] === 'granted'
      );
    } else {
      return true; // iOS handles permissions differently
    }
  };

  // Set up WebRTC peer connection
  const setupPeerConnection = async () => {
    try {
      const permissionsGranted = await getPermissions();
      if (!permissionsGranted) {
        Alert.alert('Permission Error', 'Camera and microphone permissions are required');
        return false;
      }

      // Get user media
      const stream = await mediaDevices.getUserMedia({
        audio: true,
        video: {
          facingMode: 'user',
          width: 640,
          height: 480,
        },
      });

      setLocalStream(stream);

      // Create peer connection
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
        ],
      };

      peerConnection.current = new RTCPeerConnection(configuration);

      // Add local stream to peer connection
      stream.getTracks().forEach((track) => {
        peerConnection.current.addTrack(track, stream);
      });

      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.current.emit('ice-candidate', {
            to: targetDeviceId,
            candidate: event.candidate,
          });
        }
      };

      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
        }
      };

      // Handle connection state changes
      peerConnection.current.oniceconnectionstatechange = () => {
        console.log('ICE connection state:', peerConnection.current.iceConnectionState);
        if (peerConnection.current.iceConnectionState === 'connected') {
          setCallStatus('connected');
        } else if (
          peerConnection.current.iceConnectionState === 'disconnected' ||
          peerConnection.current.iceConnectionState === 'failed'
        ) {
          setCallStatus('disconnected');
          endCall();
        }
      };

      return true;
    } catch (err) {
      console.error('Error setting up peer connection:', err);
      Alert.alert('Setup Error', 'Could not set up WebRTC connection');
      return false;
    }
  };

  // Start a call
  const startCall = async () => {
    try {
      setIsCalling(true);
      const success = await setupPeerConnection();

      if (!success) {
        setIsCalling(false);
        return;
      }

      // Create offer
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);

      // Send offer to signaling server
      socket.current.emit('offer', {
        to: targetDeviceId,
        offer: peerConnection.current.localDescription,
      });

      console.log('Call initiated to device:', targetDeviceId);
    } catch (err) {
      console.error('Error starting call:', err);
      setIsCalling(false);
      Alert.alert('Call Error', 'Could not start call');
    }
  };

  // End a call
  const endCall = () => {
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }

    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    setRemoteStream(null);
    setIsCalling(false);
    setCallStatus('disconnected');

    // Notify the other peer
    if (socket.current) {
      socket.current.emit('end-call', { to: targetDeviceId });
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.deviceId}>Device ID: {deviceId}</Text>
        <Text style={styles.statusText}>
          Status: {callStatus}
        </Text>
      </View>

      <View style={styles.videoContainer}>
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteStream}
            objectFit="cover"
          />
        )}
        {localStream && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localStream}
            objectFit="cover"
            zOrder={1} // Ensure local stream is on top
          />
        )}
      </View>

      <View style={styles.controls}>
        {!isCalling ? (
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>Call Other Device</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity 
            style={[styles.button, styles.hangupButton]} 
            onPress={endCall}
          >
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.testInfo}>
        Testing server: {SIGNALING_SERVER_URL}{'\n'}
        Target device: {targetDeviceId}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    padding: 10,
  },
  header: {
    padding: 10,
    alignItems: 'center',
  },
  deviceId: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
  videoContainer: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 10,
    marginVertical: 20,
    backgroundColor: '#333',
  },
  remoteStream: {
    flex: 1,
    backgroundColor: 'black',
  },
  localStream: {
    position: 'absolute',
    width: 100,
    height: 150,
    top: 10,
    right: 10,
    backgroundColor: '#444',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 50,
    minWidth: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callButton: {
    backgroundColor: '#4CAF50',
  },
  hangupButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  testInfo: {
    color: '#aaa',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 10,
  },
});

export default WebRTCTest;
