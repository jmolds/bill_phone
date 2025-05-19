import React, { useState, useEffect } from 'react';
import { 
  View, 
  Image, 
  StyleSheet, 
  TouchableOpacity, 
  Text,
  Animated
} from 'react-native';
import { PlaceholderImage } from './temp-image-solution';

/**
 * Contact component with animated white outline effect
 * Replaces the generic call button with contact-specific profile images
 */
const Contact = ({ 
  name, 
  imageSource, 
  onPress, 
  disabled = false, 
  size = 220,
  animationEnabled = true
}) => {
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
      // Clean up animation when component unmounts
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
      width: size - 20, // Account for border
      height: size - 20,
      borderRadius: (size - 20) / 2,
    }
  };
  
  // Calculate the animated scale for the white outline
  const outlineScale = animationEnabled ? pulseAnim : 1;
  
  return (
    <TouchableOpacity
      style={[
        styles.container, 
        dimensions.container,
        disabled && styles.disabledContainer
      ]}
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
      
      {/* Profile image - handle both real images and placeholders */}
      {imageSource && imageSource.__isPlaceholder ? (
        <PlaceholderImage 
          source={imageSource} 
          style={[
            styles.image,
            dimensions.image,
            disabled && styles.disabledImage
          ]}
        />
      ) : (
        <Image 
          source={imageSource} 
          style={[
            styles.image,
            dimensions.image,
            disabled && styles.disabledImage
          ]}
          resizeMode="cover"
        />
      )}
      
      {/* Name label */}
      <Text style={[
        styles.nameText,
        disabled && styles.disabledText
      ]}>
        {name}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginBottom: 10,
  },
  outlineEffect: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: 'white',
    shadowColor: 'white',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 8,
  },
  image: {
    backgroundColor: '#27AE60', // Default background if image fails to load
  },
  nameText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  disabledImage: {
    tintColor: '#999',
  },
  disabledText: {
    color: '#999',
  },
});

export default Contact;
