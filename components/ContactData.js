/**
 * Contact data for Bill's trusted contacts
 * This file defines the contacts that Bill is allowed to call
 */
import { createPlaceholderImage } from './temp-image-solution';

export const trustedContacts = [
  {
    id: 'family-caller',
    name: 'Family',
    // In a production app, we'd use an actual photo of Bill's family member
    // For now we use a placeholder image until real photos are added
    imageSource: createPlaceholderImage('Family', '#27AE60'),
    // The device ID used to register with the signaling server
    deviceId: 'family-caller',
  },
  // Additional trusted contacts can be added here
  // Example:
  // {
  //   id: 'caregiver-id',
  //   name: 'Caregiver',
  //   imageSource: require('../assets/contacts/caregiver.png'),
  //   deviceId: 'caregiver-id',
  // },
];

// Helper function to find a contact by ID
export const findContactById = (id) => {
  return trustedContacts.find(contact => contact.id === id);
};

// Helper function to find a contact by device ID
export const findContactByDeviceId = (deviceId) => {
  return trustedContacts.find(contact => contact.deviceId === deviceId);
};

// Export default trusted contact (Bill's primary contact)
export const defaultContact = trustedContacts[0];
