import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
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

const { width, height } = Dimensions.get('window');

// Signaling server URL as specified in requirements
const SIGNALING_SERVER_URL = 'https://api.justinmolds.com';
// Specific device IDs for production use
// Bill's phone has a fixed ID so it can be consistently reached
const DEVICE_ID = 'bills-iphone';
// The trusted contact's ID that Bill can call
const TRUSTED_CONTACT_ID = 'family-caller';

const WebRTCCall = ({ isCallEnabled, onCallStatusChange, callStatus: externalCallStatus }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  // Internal call status is synchronized with external status from App.js
  const [callStatus, setCallStatus] = useState(externalCallStatus || 'idle'); // idle, calling, incoming, connected
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  
  const peerConnection = useRef(null);
  const socket = useRef(null);

  // Update internal state when external callStatus changes
  useEffect(() => {
    if (externalCallStatus && externalCallStatus !== callStatus) {
      console.log('External call status changed to:', externalCallStatus);
      setCallStatus(externalCallStatus);
      
      // If external status is 'calling', initiate the call
      if (externalCallStatus === 'calling') {
        makeCall();
      }
    }
  }, [externalCallStatus]);
  
  // Initialize WebRTC and socket connection - with deferred socket initialization
  // and proper error handling for TestFlight builds
  useEffect(() => {
    let isMounted = true;
    
    // Function to safely initialize socket connection
    const initializeSocket = async () => {
      try {
        // Only create the socket if it doesn't already exist
        if (!socket.current) {
          console.log('Initializing socket connection to:', SIGNALING_SERVER_URL);
          
          // Setup socket connection with reconnection options
          socket.current = io(SIGNALING_SERVER_URL, {
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 10000,
            // Add explicit transport options to avoid WebSocket issues on iOS
            transports: ['websocket', 'polling'],
          });
          
          // Register device ID when connected
          socket.current.on('connect', () => {
            console.log('Connected to signaling server');
            if (socket.current) {
              socket.current.emit('register', { deviceId: DEVICE_ID });
            }
          });
          
          // Handle reconnection events
          socket.current.on('reconnect', () => {
            console.log('Reconnected to signaling server');
            if (socket.current) {
              socket.current.emit('register', { deviceId: DEVICE_ID });
            }
          });
          
          socket.current.on('disconnect', () => {
            console.log('Disconnected from signaling server');
          });
          
          socket.current.on('error', (error) => {
            console.error('Socket error:', error);
            // Don't crash on socket errors
          });
          
          // Listen for incoming calls with safe error handling
          socket.current.on('incomingCall', async ({ from, offer }) => {
            try {
              // Only accept calls from trusted contact
              if (from === TRUSTED_CONTACT_ID && isMounted) {
                setCallStatus('incoming');
                onCallStatusChange('incoming');
                
                // Create peer connection when receiving a call
                const success = await setupPeerConnection();
                
                // Only proceed if peer connection was successfully created
                if (success && peerConnection.current && isMounted) {
                  // Set the remote description with the offer
                  const remoteDesc = new RTCSessionDescription(offer);
                  await peerConnection.current.setRemoteDescription(remoteDesc);
                }
              }
            } catch (error) {
              console.error('Error handling incoming call:', error);
              // Don't crash on errors handling incoming calls
            }
          });
          
          // Handle ICE candidates safely
          socket.current.on('iceCandidate', async ({ candidate }) => {
            try {
              if (peerConnection.current && isMounted) {
                await peerConnection.current.addIceCandidate(
                  new RTCIceCandidate(candidate)
                );
              }
            } catch (error) {
              console.error('Error adding ICE candidate:', error);
              // Don't crash on ICE candidate errors
            }
          });
          
          // Handle call accepted
          socket.current.on('callAccepted', async ({ answer }) => {
            try {
              if (callStatus === 'calling' && peerConnection.current && isMounted) {
                const remoteDesc = new RTCSessionDescription(answer);
                await peerConnection.current.setRemoteDescription(remoteDesc);
              }
            } catch (error) {
              console.error('Error handling accepted call:', error);
              // Don't crash on errors when handling accepted calls
            }
          });
          
          // Handle call ended
          socket.current.on('callEnded', () => {
            if (isMounted) {
              endCall();
            }
          });
        }
      } catch (error) {
        console.error('Socket initialization error:', error);
        // Don't crash on socket initialization errors
      }
    };
    
    // Don't initialize socket immediately on component mount
    // Only initialize when needed (when call status changes)
    if (externalCallStatus === 'calling' || externalCallStatus === 'incoming') {
      initializeSocket();
    }
    
    // Cleanup function
    return () => {
      isMounted = false;
      // Clean up socket connection if component unmounts
      if (socket.current) {
        socket.current.disconnect();
      }
    };
  }, [externalCallStatus, callStatus]);
    
    // Clean up resources when component unmounts
    return () => {
      if (socket.current) {
        socket.current.disconnect();
      }
      cleanupWebRTC();
    };
  }, [externalCallStatus, callStatus]);

  // Set up WebRTC peer connection with safer media permission handling
  const setupPeerConnection = async () => {
    try {
      console.log('Setting up peer connection and requesting media permissions');
      
      // Create peer connection first with minimal STUN servers
      // This allows us to separate connection errors from permission errors
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' }
        ]
      };
      
      // Create peer connection before requesting media to separate errors
      peerConnection.current = new RTCPeerConnection(configuration);
      
      // Set up event handlers for connection before adding media
      // Handle incoming stream
      peerConnection.current.ontrack = (event) => {
        try {
          if (event.streams && event.streams[0]) {
            console.log('Remote stream received');
            setRemoteStream(event.streams[0]);
          }
        } catch (error) {
          console.error('Error handling remote stream:', error);
          // Don't crash on remote stream errors
        }
      };
      
      // Handle ICE candidates
      peerConnection.current.onicecandidate = (event) => {
        try {
          if (event.candidate && socket.current) {
            console.log('ICE candidate generated');
            socket.current.emit('iceCandidate', {
              to: TRUSTED_CONTACT_ID,
              candidate: event.candidate,
            });
          }
        } catch (error) {
          console.error('Error handling ICE candidate:', error);
          // Don't crash on ICE candidate errors
        }
      };
      
      // Handle connection state changes
      peerConnection.current.oniceconnectionstatechange = () => {
        try {
          const state = peerConnection.current ? peerConnection.current.iceConnectionState : 'unknown';
          console.log('ICE connection state changed to:', state);
          
          if (state === 'connected') {
            setCallStatus('connected');
            onCallStatusChange('connected');
          } else if (state === 'disconnected' || state === 'failed') {
            console.log('ICE connection failed or disconnected');
            endCall();
          }
        } catch (error) {
          console.error('Error handling ICE connection state change:', error);
          // Don't crash on connection state errors
        }
      };
      
      // Now that the peer connection is set up, request media permissions
      console.log('Requesting media permissions...');
      const mediaConstraints = {
        audio: true,
        video: {
          width: 640,
          height: 480,
          frameRate: 30,
          facingMode: 'user',
        },
      };
      
      // Use a timeout to prevent hanging if permissions dialog is stuck
      let mediaPermissionTimeout;
      const mediaPromise = new Promise(async (resolve, reject) => {
        // Set a timeout to handle potential permission dialog hanging
        mediaPermissionTimeout = setTimeout(() => {
          reject(new Error('Media permission request timed out'));
        }, 10000); // 10 second timeout
        
        try {
          const stream = await mediaDevices.getUserMedia(mediaConstraints);
          clearTimeout(mediaPermissionTimeout);
          resolve(stream);
        } catch (err) {
          clearTimeout(mediaPermissionTimeout);
          reject(err);
        }
      });
      
      try {
        const stream = await mediaPromise;
        console.log('Media permissions granted');
        setLocalStream(stream);
        
        // Add local stream to peer connection
        stream.getTracks().forEach((track) => {
          if (peerConnection.current) {
            peerConnection.current.addTrack(track, stream);
          }
        });
        
        return true;
      } catch (mediaError) {
        console.error('Media permission error:', mediaError);
        Alert.alert(
          'Camera/Microphone Access',
          'Please allow access to your camera and microphone to make calls.',
          [
            { text: 'OK', onPress: () => console.log('Media permission alert acknowledged') }
          ]
        );
        onCallStatusChange('idle'); // Reset call status on permission error
        return false;
      }
    } catch (error) {
      console.error('Error setting up WebRTC:', error);
      Alert.alert('Connection Error', 'Could not set up call functionality. Please try again later.');
      onCallStatusChange('idle'); // Reset call status on setup error
      return false;
    }
  };

  // Make an outgoing call
  const makeCall = async () => {
    if (!isCallEnabled && callStatus !== 'calling') return;
    
    try {
      // Only update if we're not already in 'calling' state from external update
      if (callStatus !== 'calling') {
        setCallStatus('calling');
        onCallStatusChange('calling');
      }
      
      const success = await setupPeerConnection();
      if (!success) return;
      
      // Create offer
      const offer = await peerConnection.current.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      
      await peerConnection.current.setLocalDescription(offer);
      
      // Send offer to signaling server
      socket.current.emit('makeCall', {
        to: TRUSTED_CONTACT_ID,
        offer,
      });
    } catch (error) {
      console.error('Error making call:', error);
      Alert.alert('Error', 'Failed to make call');
      setCallStatus('idle');
      onCallStatusChange('idle');
    }
  };

  // Auto-answer if call is from trusted contact - this is optional and can be enabled/disabled
  const autoAnswerCall = () => {
    // Implementation can be added here to automatically answer calls from trusted contacts
    // For now, we'll just trigger the standard answer call function
    answerCall();
  };
  
  // Answer an incoming call
  const answerCall = async () => {
    try {
      // Create answer
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      
      // Send answer to signaling server
      socket.current.emit('answerCall', {
        to: TRUSTED_CONTACT_ID,
        answer,
      });
      
      setCallStatus('connected');
      onCallStatusChange('connected');
    } catch (error) {
      console.error('Error answering call:', error);
      Alert.alert('Error', 'Failed to answer call');
      setCallStatus('idle');
      onCallStatusChange('idle');
    }
  };

  // End the current call
  const endCall = () => {
    if (callStatus !== 'idle') {
      // Send end call signal
      if (socket.current) {
        socket.current.emit('endCall', {
          to: TRUSTED_CONTACT_ID,
        });
      }
      
      cleanupWebRTC();
      setCallStatus('idle');
      onCallStatusChange('idle');
    }
  };

  // Clean up WebRTC resources
  const cleanupWebRTC = () => {
    // Stop local tracks
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Clean up peer connection
    if (peerConnection.current) {
      peerConnection.current.close();
      peerConnection.current = null;
    }
    
    setRemoteStream(null);
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
        setIsMuted(!track.enabled);
      });
    }
  };

  // Toggle speaker
  const toggleSpeaker = () => {
    // This is a placeholder - in a real app, we would use audio routing
    setIsSpeakerOn(!isSpeakerOn);
  };

  // Update local and external status together
  const updateCallStatus = (newStatus) => {
    setCallStatus(newStatus);
    onCallStatusChange(newStatus);
  };
  
  // Render different UI based on call status
  const renderCallContent = () => {
    switch (callStatus) {
      case 'idle':
        return (
          <TouchableOpacity
            style={[styles.callButton, !isCallEnabled && styles.disabledButton]}
            onPress={makeCall}
            disabled={!isCallEnabled}
          >
            <Text style={styles.buttonText}>Call</Text>
          </TouchableOpacity>
        );
      
      case 'calling':
        return (
          <View style={styles.activeCallContainer}>
            <Text style={styles.callStatusText}>Calling...</Text>
            <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
              <Text style={styles.buttonText}>End Call</Text>
            </TouchableOpacity>
          </View>
        );
      
      case 'incoming':
        return (
          <View style={styles.activeCallContainer}>
            <Text style={styles.callStatusText}>Incoming Call</Text>
            <View style={styles.incomingCallButtons}>
              <TouchableOpacity style={styles.answerButton} onPress={answerCall}>
                <Text style={styles.buttonText}>Answer</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
                <Text style={styles.buttonText}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      case 'connected':
        return (
          <View style={styles.connectedCallContainer}>
            {remoteStream && (
              <RTCView
                streamURL={remoteStream.toURL()}
                style={styles.remoteVideo}
                objectFit="cover"
                zOrder={1}
              />
            )}
            {localStream && (
              <RTCView
                streamURL={localStream.toURL()}
                style={styles.localVideo}
                objectFit="cover"
                zOrder={2}
              />
            )}
            <View style={styles.callControls}>
              <TouchableOpacity 
                style={[styles.controlButton, isMuted && styles.activeControlButton]} 
                onPress={toggleMute}
              >
                <Text style={styles.controlButtonText}>
                  {isMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
                <Text style={styles.buttonText}>End Call</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.controlButton, isSpeakerOn && styles.activeControlButton]} 
                onPress={toggleSpeaker}
              >
                <Text style={styles.controlButtonText}>
                  {isSpeakerOn ? 'Speaker Off' : 'Speaker On'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {renderCallContent()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callButton: {
    width: 220,  // Increased size for better accessibility
    height: 220, // Increased size for better accessibility
    borderRadius: 110,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  disabledButton: {
    backgroundColor: '#95A5A6',
    opacity: 0.7,
  },
  buttonText: {
    color: 'white',
    fontSize: 36, // Increased font size for better accessibility
    fontWeight: 'bold',
  },
  activeCallContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callStatusText: {
    fontSize: 24,
    color: 'white',
    marginBottom: 30,
  },
  endCallButton: {
    width: 180, // Increased size for better accessibility
    height: 80, // Increased size for better accessibility
    borderRadius: 40,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 10,
  },
  incomingCallButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '80%',
  },
  answerButton: {
    width: 180, // Increased size for better accessibility
    height: 80, // Increased size for better accessibility
    borderRadius: 40,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectedCallContainer: {
    width: width,
    height: height * 0.8,
    position: 'relative',
  },
  remoteVideo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#2C3E50',
  },
  localVideo: {
    position: 'absolute',
    top: 20,
    right: 20,
    width: 100,
    height: 150,
    backgroundColor: '#34495E',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'white',
  },
  callControls: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 120, // Increased size for better accessibility
    height: 60, // Increased size for better accessibility
    borderRadius: 30,
    backgroundColor: '#3498DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeControlButton: {
    backgroundColor: '#2980B9',
  },
  controlButtonText: {
    color: 'white',
    fontSize: 22, // Increased font size for better accessibility
    fontWeight: 'bold',
  },
});

export default WebRTCCall;
