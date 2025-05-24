import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar, Animated, Dimensions, Image, Alert } from 'react-native';
import Contact from './components/Contact';
import { defaultContact } from './components/ContactData';
import * as ScreenOrientation from 'expo-screen-orientation';

// Simulation component to replace WebRTCCall
const SimulatedWebRTCCall = ({ isCallEnabled, onCallStatusChange, callStatus }) => {
  const [connectedTime, setConnectedTime] = useState(0);
  const [timer, setTimer] = useState(null);
  
  // Handle call timer when connected
  useEffect(() => {
    if (callStatus === 'connected') {
      // Start call timer
      const t = setInterval(() => {
        setConnectedTime(prev => prev + 1);
      }, 1000);
      setTimer(t);
    } else {
      // Clear timer if not connected
      if (timer) {
        clearInterval(timer);
        setTimer(null);
        setConnectedTime(0);
      }
    }

    return () => {
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [callStatus]);
  
  // Format time for display
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };
  
  // Simulate auto-connection after delay
  useEffect(() => {
    if (callStatus === 'calling') {
      const timeout = setTimeout(() => {
        console.log('Simulated call connected');
        onCallStatusChange('connected');
      }, 3000);
      
      return () => clearTimeout(timeout);
    }
  }, [callStatus, onCallStatusChange]);
  
  // Handle ending the call
  const handleEndCall = () => {
    console.log('Call ended by user');
    onCallStatusChange('idle');
  };
  
  if (callStatus === 'idle') {
    return null;
  }
  
  return (
    <View style={styles.callContainer}>
      {/* Mock remote video stream */}
      <View style={styles.remoteVideoContainer}>
        <Text style={styles.simulationText}>SIMULATED REMOTE VIDEO</Text>
        
        {callStatus === 'connected' && (
          <View style={styles.callTimeContainer}>
            <Text style={styles.callTimeText}>{formatTime(connectedTime)}</Text>
          </View>
        )}
      </View>
      
      {/* Mock local video stream */}
      <View style={styles.localVideoContainer}>
        <Text style={styles.simulationText}>LOCAL</Text>
      </View>
      
      {/* Call controls */}
      {callStatus === 'connected' && (
        <TouchableOpacity 
          style={styles.endCallButton}
          onPress={handleEndCall}
        >
          <Text style={styles.endCallText}>End Call</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * Simulated Version of Bill's Phone App
 * 
 * This version replicates the exact UI and behavior of the production app
 * but uses simulated WebRTC functionality for UI development in Expo Go.
 */
const SimulatedApp = () => {
  // State management - identical to production App.js
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCallTime, setIsCallTime] = useState(false);
  const [canCall, setCanCall] = useState(false); // Based on hourly limit
  const [lastCallAttempt, setLastCallAttempt] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, calling, incoming, connected
  
  // Animation values
  const timelinePosition = useState(new Animated.Value(0))[0];
  const dotOpacity = useState(new Animated.Value(1))[0];
  
  // Screen dimensions
  const screen = Dimensions.get('window');
  
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
      
      // FOR SIMULATION: Override time restrictions for easier testing
      // Comment the following line for production behavior
      const isWithinCallHours = true; // Always allow in simulation mode
      
      // Uncomment for production behavior:
      // const hour = now.getHours();
      // const isWithinCallHours = hour >= 17 && hour <= 22;
      
      setIsCallTime(isWithinCallHours);
      
      // Check if an hour has passed since last call attempt
      if (lastCallAttempt) {
        const timeSinceLastCall = now.getTime() - lastCallAttempt.getTime();
        const oneHourInMs = 60 * 60 * 1000;
        
        // FOR SIMULATION: Override cooldown for easier testing (set to 10 seconds)
        // Comment the following line for production behavior
        const cooldownMs = 10 * 1000; // 10 seconds for testing
        setCanCall(timeSinceLastCall > cooldownMs);
        
        // Uncomment for production behavior:
        // setCanCall(timeSinceLastCall > oneHourInMs);
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
    const interval = setInterval(checkCallAvailability, 30000); // Check every 30 seconds instead of 60 in simulation
    
    return () => clearInterval(interval);
  }, [lastCallAttempt, timelinePosition, dotOpacity]);
  
  // Handle call button press
  const handleCallPress = () => {
    // Record the call attempt time to enforce the hourly limit
    setLastCallAttempt(new Date());
    setCanCall(false);
    
    // Log the call attempt
    console.log('[SIMULATION] Call initiated at', new Date().toLocaleTimeString());
    
    // Update call status to initiate WebRTC call
    setCallStatus('calling');
    
    // For simulation feedback
    Alert.alert('Simulation Mode', 'Starting simulated call...');
  };
  
  // Handle call status changes from WebRTCCall component
  const handleCallStatusChange = (status) => {
    console.log('[SIMULATION] Call status changed to:', status);
    setCallStatus(status);
  };
  
  // Format time for display (12-hour format with AM/PM)
  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes} ${ampm}`;
  };

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
      <StatusBar hidden={true} />
      
      {/* SIMULATION MODE INDICATOR */}
      <View style={styles.simulationBanner}>
        <Text style={styles.simulationBannerText}>SIMULATION MODE</Text>
      </View>
      
      {/* Top timeline */}
      <View style={styles.timelineContainer}>
        <View style={styles.timeline} />
        <Animated.View 
          style={[
            styles.timelineDot, 
            { left: topDotPosition, opacity: dotOpacity }
          ]}
        />
        
        {/* Night indicators (jogs) */}
        <View style={[styles.timelineJog, { left: '0%' }]} />
        <View style={[styles.timelineJog, { right: '0%' }]} />
      </View>
      
      {/* Main content area */}
      <View style={styles.contentContainer}>
        {/* Minimal time display */}
        <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
        
        {/* WebRTC simulation - Only render when needed */}
        {callStatus !== 'idle' && (
          <SimulatedWebRTCCall 
            isCallEnabled={isCallTime && canCall && callStatus === 'idle'}
            onCallStatusChange={handleCallStatusChange}
            callStatus={callStatus}
          />
        )}
        
        {/* Call button with contact profile - only shown when calls are allowed and not in a call */}
        {isCallTime && canCall && callStatus === 'idle' && (
          <Contact 
            name={defaultContact.name}
            imageSource={defaultContact.imageSource}
            onPress={handleCallPress}
            animationEnabled={true}
            size={200}
          />
        )}
        
        {/* Show message when call is on cooldown */}
        {isCallTime && !canCall && callStatus === 'idle' && (
          <Text style={styles.cooldownText}>You can call again in 10 seconds</Text> // Modified for simulation
        )}
        
        {/* Show status messages during calls */}
        {callStatus === 'calling' && (
          <Text style={styles.statusText}>Calling {defaultContact.name}...</Text>
        )}
        
        {callStatus === 'incoming' && (
          <Text style={styles.statusText}>Incoming call from {defaultContact.name}</Text>
        )}
      </View>
      
      {/* Bottom timeline (mirror of top) */}
      <View style={styles.timelineContainer}>
        <View style={styles.timeline} />
        <Animated.View 
          style={[
            styles.timelineDot, 
            { left: bottomDotPosition, opacity: dotOpacity }
          ]}
        />
        
        {/* Night indicators (jogs) */}
        <View style={[styles.timelineJog, { left: '0%' }]} />
        <View style={[styles.timelineJog, { right: '0%' }]} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 10
  },
  // Banner to indicate simulation mode
  simulationBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255, 0, 0, 0.7)',
    paddingVertical: 5,
    zIndex: 100,
  },
  simulationBannerText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  timelineContainer: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative'
  },
  timeline: {
    width: '90%',
    height: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    position: 'absolute'
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: 'white',
    position: 'absolute',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5
  },
  timelineJog: {
    width: 20,
    height: 30,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderBottomWidth: 0,
    position: 'absolute',
    bottom: 0
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%'
  },
  timeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20
  },
  callButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 3,
    borderColor: 'white',
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
  buttonText: {
    color: 'white',
    fontSize: 36,
    fontWeight: 'bold',
  },
  statusText: {
    color: '#4CAF50',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginVertical: 10,
  },
  cooldownText: {
    color: '#F39C12',
    fontSize: 24,
    marginTop: 20,
    textAlign: 'center',
  },
  // Simulated WebRTC call styles
  callContainer: {
    width: '100%',
    height: 400,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  remoteVideoContainer: {
    width: '80%',
    height: 300,
    backgroundColor: '#2C3E50',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  localVideoContainer: {
    position: 'absolute',
    width: 100,
    height: 150,
    backgroundColor: '#34495E',
    bottom: 20,
    right: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 5,
    borderWidth: 2,
    borderColor: 'white',
  },
  simulationText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  callTimeContainer: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 5,
    borderRadius: 5,
  },
  callTimeText: {
    color: 'white',
    fontSize: 16,
  },
  endCallButton: {
    position: 'absolute',
    bottom: -40,
    backgroundColor: '#F44336',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 25,
  },
  endCallText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  }
});

export default SimulatedApp;
