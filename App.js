import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StatusBar } from 'react-native';

/**
 * Bill's Phone App - Kiosk Mode
 * 
 * A minimal, accessibility-focused interface that allows Bill to:
 * - Make calls during specific hours (initially just to one contact)
 * - Limited to one call attempt per hour
 * - Receive incoming calls
 * - Clearly see when calling is available
 */
const App = () => {
  // State management
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isCallTime, setIsCallTime] = useState(false);
  const [canCall, setCanCall] = useState(false); // Based on hourly limit
  const [lastCallAttempt, setLastCallAttempt] = useState(null);

  // Check if current time is within allowed calling hours
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
    };
    
    // Check immediately and then every minute
    checkCallAvailability();
    const interval = setInterval(checkCallAvailability, 60000);
    
    return () => clearInterval(interval);
  }, [lastCallAttempt]);
  
  // Handle call button press
  const handleCallPress = () => {
    // Record the call attempt time to enforce the hourly limit
    setLastCallAttempt(new Date());
    setCanCall(false);
    
    // This would trigger the actual call in the full implementation
    // For now, just log the action
    console.log('Call initiated at', new Date().toLocaleTimeString());
    
    // In the full version, this would integrate with WebRTC
    alert('Call feature will be implemented by the next developer');
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

  return (
    <View style={styles.container}>
      <StatusBar hidden={true} />
      
      {/* Time display */}
      <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
      
      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <View style={[styles.statusIndicator, { backgroundColor: isCallTime ? '#27AE60' : '#E74C3C' }]} />
        <Text style={styles.statusText}>
          {isCallTime ? 'Calling Available' : 'Calling Not Available'}
        </Text>
      </View>
      
      {/* Call button - only shown when calls are allowed */}
      {isCallTime && canCall && (
        <TouchableOpacity style={styles.callButton} onPress={handleCallPress}>
          <Text style={styles.buttonText}>Call</Text>
        </TouchableOpacity>
      )}
      
      {/* Show message when call is on cooldown */}
      {isCallTime && !canCall && (
        <Text style={styles.cooldownText}>You can call again in 1 hour</Text>
      )}
      
      {/* Help text */}
      <Text style={styles.helpText}>
        {!isCallTime 
          ? 'Calling is available from 5:00 PM to 10:00 PM' 
          : canCall 
            ? 'Tap the button to make a call' 
            : 'Please wait before calling again'}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20
  },
  timeText: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 40
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    padding: 15,
    borderRadius: 15,
  },
  statusIndicator: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 15,
  },
  statusText: {
    fontSize: 28,
    color: 'white',
    fontWeight: '600',
  },
  callButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#27AE60',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 30,
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
  cooldownText: {
    color: '#F39C12',
    fontSize: 24,
    marginVertical: 30,
    textAlign: 'center',
  },
  helpText: {
    color: 'white',
    fontSize: 20,
    textAlign: 'center',
    paddingHorizontal: 20,
    marginTop: 20,
    opacity: 0.8
  }
});

export default App;
