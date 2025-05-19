/**
 * Temporary solution for profile images
 * 
 * Since we can't create actual image files through this interface, this component
 * provides a workaround by rendering a placeholder image with the name of the contact
 * until real images can be provided during the actual build process.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

// This function returns an object that mimics an image source but displays a placeholder
export const createPlaceholderImage = (name, color = '#27AE60') => {
  return {
    // Special property to identify this as a placeholder
    __isPlaceholder: true,
    name,
    color
  };
};

// Component to render a placeholder image
export const PlaceholderImage = ({ source, style }) => {
  // Only process if this is our placeholder format
  if (!source || !source.__isPlaceholder) {
    return null;
  }
  
  const { name, color } = source;
  
  return (
    <View style={[styles.container, { backgroundColor: color }, style]}>
      <Text style={styles.initial}>{name.charAt(0).toUpperCase()}</Text>
      <Text style={styles.name}>{name}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  initial: {
    color: 'white',
    fontSize: 72,
    fontWeight: 'bold',
  },
  name: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
  }
});
