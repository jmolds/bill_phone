import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, StatusBar, Alert } from 'react-native';

/**
 * Test version of Bill's Phone App with call simulation
 * 
 * This version simulates call behavior without using WebRTC,
 * which requires a development build to work with native modules.
 */
const TestApp = () => {
  // State for call simulation
  const [deviceId, setDeviceId] = useState('');
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, connected, ended
  const [connectedTime, setConnectedTime] = useState(0);
  const [callTimer, setCallTimer] = useState(null);

  // Generate a simple device ID on startup
  useEffect(() => {
    // Generate random device ID to simulate multiple devices
    const id = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    setDeviceId(id);
  }, []);

  // Handle call timer when connected
  useEffect(() => {
    if (callStatus === 'connected' && !callTimer) {
      // Start timer when call is connected
      const timer = setInterval(() => {
        setConnectedTime(prev => prev + 1);
      }, 1000);
      setCallTimer(timer);
    } else if (callStatus !== 'connected' && callTimer) {
      // Clear timer when call ends
      clearInterval(callTimer);
      setCallTimer(null);
      setConnectedTime(0);
    }

    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  }, [callStatus, callTimer]);

  // Format time for display (mm:ss)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Simulate making a call
  const startCall = () => {
    setCallStatus('calling');
    
    // Simulate connection delay
    Alert.alert('Calling', 'Connecting to other device...');
    
    // Simulate connection establishment after delay
    setTimeout(() => {
      setCallStatus('connected');
      Alert.alert('Connected', 'Call connected successfully!');
    }, 2000);
  };

  // Simulate ending a call
  const endCall = () => {
    setCallStatus('ended');
    setTimeout(() => {
      setCallStatus('idle');
    }, 1000);
    Alert.alert('Call Ended', 'Call has been disconnected');
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#121212" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Bill's Phone</Text>
        <Text style={styles.subtitle}>Call Simulation Mode</Text>
      </View>
      
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceId}>Device ID: {deviceId}</Text>
        <Text style={styles.statusText}>
          Status: <Text style={styles[callStatus + 'Status']}>{callStatus.toUpperCase()}</Text>
        </Text>
        {callStatus === 'connected' && (
          <Text style={styles.callTime}>Call Time: {formatTime(connectedTime)}</Text>
        )}
      </View>
      
      <View style={styles.mockVideo}>
        {callStatus === 'connected' && (
          <Text style={styles.mockVideoText}>SIMULATED VIDEO STREAM</Text>
        )}
      </View>
      
      <View style={styles.controls}>
        {callStatus === 'idle' && (
          <TouchableOpacity
            style={[styles.button, styles.callButton]}
            onPress={startCall}
          >
            <Text style={styles.buttonText}>Simulate Call</Text>
          </TouchableOpacity>
        )}
        
        {(callStatus === 'calling' || callStatus === 'connected') && (
          <TouchableOpacity
            style={[styles.button, styles.hangupButton]}
            onPress={endCall}
          >
            <Text style={styles.buttonText}>End Call</Text>
          </TouchableOpacity>
        )}
      </View>
      
      <View style={styles.noteContainer}>
        <Text style={styles.note}>
          This is a simulation only. WebRTC requires a development build.
        </Text>
        <Text style={styles.explainer}>
          To test with real WebRTC connections, you need to create a
          development build using: npx expo prebuild
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#aaa',
  },
  deviceInfo: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 15,
    margin: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  deviceId: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  statusText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 5,
  },
  callTime: {
    color: '#4CAF50',
    fontSize: 20,
    fontWeight: 'bold',
  },
  idleStatus: {
    color: '#808080',
  },
  callingStatus: {
    color: '#FFC107',
  },
  connectedStatus: {
    color: '#4CAF50',
  },
  endedStatus: {
    color: '#F44336',
  },
  mockVideo: {
    flex: 1,
    backgroundColor: '#2C3E50',
    margin: 15,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mockVideoText: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  button: {
    padding: 15,
    borderRadius: 50,
    minWidth: 150,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 10,
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
  noteContainer: {
    padding: 15,
    marginBottom: 20,
  },
  note: {
    color: '#FF9800',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 5,
  },
  explainer: {
    color: '#999',
    textAlign: 'center',
    fontSize: 12,
  }
});

export default TestApp;
