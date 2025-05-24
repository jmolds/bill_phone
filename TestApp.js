import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Dimensions, Image, Alert } from 'react-native';
import * as ScreenOrientation from 'expo-screen-orientation';

// Import the Contact component if available, or create a simulation version
import { createPlaceholderImage } from './components/temp-image-solution';

// Simulation Contact component
const SimContact = ({ name, imageSource, onPress, disabled = false, size = 220, animationEnabled = true }) => {
  // Animation for the pulsing white outline effect
  const [pulseAnim] = useState(new Animated.Value(1));
  
  // Set up the pulsing animation when component mounts
  useEffect(() => {
    if (animationEnabled) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          })
        ])
      ).start();
    }
    return () => {
      pulseAnim.stopAnimation();
    };
  }, [animationEnabled]);
  
  // Calculate dimensions based on the provided size
  const dimensions = {
    container: {
      width: size,
      height: size,
      borderRadius: size / 2,
    },
    image: {
      width: size - 20,
      height: size - 20,
      borderRadius: (size - 20) / 2,
    }
  };
  
  // Calculate the animated scale for the white outline
  const outlineScale = animationEnabled ? pulseAnim : 1;
  
  return (
    <TouchableOpacity
      style={[styles.contactContainer, dimensions.container, disabled && styles.disabledContainer]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {/* Animated white outline */}
      <Animated.View 
        style={[
          styles.outlineEffect,
          dimensions.container,
          {
            transform: [{ scale: outlineScale }],
            opacity: disabled ? 0.3 : 0.9
          }
        ]}
      />
      
      {/* Profile circle with name */}
      <View style={[styles.contactImage, dimensions.image, disabled && styles.disabledImage]}>
        <Text style={styles.contactInitial}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      
      {/* Name label */}
      <Text style={[styles.contactName, disabled && styles.disabledText]}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

// Create a simulation contact
const defaultContact = {
  id: 'family-caller',
  name: 'Family',
  deviceId: 'family-caller',
};

/**
 * Test version of Bill's Phone App with call simulation
 * 
 * This version simulates the production app's UI and behavior without WebRTC,
 * allowing for faster UI development using Expo Go without rebuilding.
 */
const TestApp = () => {
  // State management (matches production App.js)
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCallTime, setIsCallTime] = useState(false);
  const [canCall, setCanCall] = useState(false); // Based on hourly limit
  const [lastCallAttempt, setLastCallAttempt] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, connected
  
  // Animation values for timeline
  const timelinePosition = useState(new Animated.Value(0))[0];
  const dotOpacity = useState(new Animated.Value(1))[0];
  
  // Simulation state
  const [connectedTime, setConnectedTime] = useState(0);
  const [callTimer, setCallTimer] = useState(null);
  
  // Force landscape orientation
  useEffect(() => {
    const lockOrientation = async () => {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    };
    lockOrientation();
  }, []);

  // Check if current time is within allowed calling hours and update timeline position
  // Currently set to 5PM-10PM EST as per requirements
  useEffect(() => {
    const checkCallAvailability = () => {
      const now = new Date();
      setCurrentTime(now);
      
      // Check if current hour is between 5PM-10PM (17-22)
      const hour = now.getHours();
      const isWithinCallHours = hour >= 17 && hour <= 22;
      setIsCallTime(isWithinCallHours);
      
      // Check if an hour has passed since last call attempt
      if (lastCallAttempt) {
        const timeSinceLastCall = now.getTime() - lastCallAttempt.getTime();
        const oneHourInMs = 60 * 60 * 1000;
        setCanCall(timeSinceLastCall > oneHourInMs);
      } else {
        setCanCall(true);
      }
      
      // Calculate position on timeline (9AM-9PM span)
      const minutes = now.getHours() * 60 + now.getMinutes();
      const dayStart = 9 * 60; // 9AM in minutes
      const dayEnd = 21 * 60; // 9PM in minutes
      const totalDayMinutes = dayEnd - dayStart;
      
      // Calculate position percentage (0.0 to 1.0)
      let positionPercent;
      
      if (minutes < dayStart) {
        // Before 9AM, in the "jog down" area
        positionPercent = 0;
      } else if (minutes > dayEnd) {
        // After 9PM, in the "jog down" area
        positionPercent = 1;
      } else {
        // Between 9AM-9PM, on the main timeline
        positionPercent = (minutes - dayStart) / totalDayMinutes;
      }
      
      // Update timeline position animation
      Animated.timing(timelinePosition, {
        toValue: positionPercent,
        duration: 500,
        useNativeDriver: false
      }).start();
      
      // Create blinking effect
      Animated.sequence([
        Animated.timing(dotOpacity, {
          toValue: 0.4,
          duration: 1000,
          useNativeDriver: false
        }),
        Animated.timing(dotOpacity, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false
        })
      ]).start();
    };
    
    // Check immediately and then every minute
    checkCallAvailability();
    const interval = setInterval(checkCallAvailability, 60000);
    
    return () => clearInterval(interval);
  }, [lastCallAttempt, timelinePosition, dotOpacity]);

  // Format time for display (12-hour format with AM/PM)
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

  // Format seconds to MM:SS for call duration
  const formatCallTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Handle call timer when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      // Start call timer
      const timer = setInterval(() => {
        setConnectedTime(prev => prev + 1);
      }, 1000);
      setCallTimer(timer);
    } else {
      // Clear timer if not connected
      if (callTimer) {
        clearInterval(callTimer);
        setCallTimer(null);
        setConnectedTime(0);
      }
    }

    return () => {
      if (callTimer) {
        clearInterval(callTimer);
      }
    };
  }, [callStatus]);

  // Handle call button press - matches production behavior
  const handleCallPress = () => {
    // Record the call attempt time to enforce the hourly limit
    setLastCallAttempt(new Date());
    setCanCall(false);
    
    // Log the call attempt
    console.log('Call initiated at', new Date().toLocaleTimeString());
    
    // Update call status to initiate simulated call
    setCallStatus('calling');
    setTimeout(() => Alert.alert('Simulation', 'Call initiated in simulation mode'), 100);
  };

  // End a call (simulation)
  const endCall = () => {
    setCallStatus('ended');
    setTimeout(() => setCallStatus('idle'), 2000);
  };

  // Accept an incoming call (simulation for future use)
  const acceptCall = () => {
    setCallStatus('connected');
  };

  // Simulation of auto-connection after 3 seconds of 'calling'
  useEffect(() => {
    if (callStatus === 'calling') {
      const timeout = setTimeout(() => {
        setCallStatus('connected');
        Alert.alert('Simulation', 'Call connected in simulation mode');
      }, 3000);

      return () => clearTimeout(timeout);
    }
  }, [callStatus]);
  
  // Calculate dot positions based on timeline position
  const topDotPosition = timelinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '95%']
  });
  
  const bottomDotPosition = timelinePosition.interpolate({
    inputRange: [0, 1],
    outputRange: ['5%', '95%']
  });

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
