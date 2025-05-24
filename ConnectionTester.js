import React, { useState, useEffect, useRef } from 'react';
import {
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  SafeAreaView,
  Platform
} from 'react-native';
import io from 'socket.io-client';

/**
 * ConnectionTester
 * 
 * A minimal component to test socket.io connection to the signaling server
 * without the complexity of WebRTC. This helps isolate if the problem is 
 * with the socket connection or with the WebRTC implementation.
 */
const ConnectionTester = () => {
  // State
  const [serverUrl, setServerUrl] = useState('http://143.198.180.248:3000');
  const [deviceId, setDeviceId] = useState('bills-iphone');
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const [logs, setLogs] = useState([]);
  const [isConnected, setIsConnected] = useState(false);

  // Refs
  const socketRef = useRef(null);
  const logsRef = useRef([]);

  // Add a log entry
  const log = (message) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `${timestamp}: ${message}`;
    console.log(logEntry);
    logsRef.current = [...logsRef.current, logEntry];
    setLogs([...logsRef.current]);
  };

  // Connect to the signaling server
  const connectToServer = () => {
    // Disconnect any existing socket
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    log(`Attempting to connect to: ${serverUrl} as ${deviceId}`);
    setConnectionStatus('Connecting...');

    try {
      // First try with WebSocket transport
      log('Connecting with WebSocket transport...');
      
      socketRef.current = io(serverUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        timeout: 10000,
      });

      setupSocketEvents();

      // If websocket fails, try polling after 5 seconds
      setTimeout(() => {
        if (!isConnected && socketRef.current) {
          log('WebSocket connection failed, trying polling transport...');
          socketRef.current.disconnect();
          
          socketRef.current = io(serverUrl, {
            transports: ['polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            timeout: 10000,
          });
          
          setupSocketEvents();
        }
      }, 5000);
    } catch (error) {
      log(`Connection error: ${error.message}`);
      setConnectionStatus('Connection Failed');
    }
  };

  // Setup socket event handlers
  const setupSocketEvents = () => {
    const socket = socketRef.current;
    
    socket.on('connect', () => {
      log('Connected to server!');
      setConnectionStatus('Connected');
      setIsConnected(true);
      
      // Register with the server
      log(`Registering as: ${deviceId}`);
      socket.emit('register', { deviceId });
      
      // Send a second registration after a delay (helps with mobile issues)
      setTimeout(() => {
        log('Sending second registration');
        socket.emit('register', { deviceId });
      }, 1000);
    });

    socket.on('connect_error', (error) => {
      log(`Connection error: ${error.message || 'Unknown error'}`);
      setConnectionStatus('Connection Failed');
      setIsConnected(false);
    });

    socket.on('error', (error) => {
      log(`Socket error: ${error.message || 'Unknown error'}`);
    });

    socket.on('disconnect', (reason) => {
      log(`Disconnected: ${reason}`);
      setConnectionStatus('Disconnected');
      setIsConnected(false);
    });

    // Listen for basic messages from the server
    socket.on('message', (data) => {
      log(`Received message: ${JSON.stringify(data)}`);
    });

    // Listen for custom test event
    socket.on('connectionTest', (data) => {
      log(`Connection test response: ${JSON.stringify(data)}`);
    });
  };

  // Send a test ping to the server
  const sendTestPing = () => {
    if (!socketRef.current || !isConnected) {
      log('Cannot send ping: not connected');
      return;
    }

    log('Sending test ping to server');
    socketRef.current.emit('connectionTest', { 
      from: deviceId, 
      message: 'Connection test from mobile app',
      device: Platform.OS,
      timestamp: new Date().toISOString()
    });
  };

  // Disconnect from the server
  const disconnect = () => {
    if (socketRef.current) {
      log('Disconnecting from server');
      socketRef.current.disconnect();
      socketRef.current = null;
      setConnectionStatus('Disconnected');
      setIsConnected(false);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Socket.IO Connection Tester</Text>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Server URL:</Text>
        <TextInput
          style={styles.input}
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      
      <View style={styles.inputContainer}>
        <Text style={styles.label}>Device ID:</Text>
        <TextInput
          style={styles.input}
          value={deviceId}
          onChangeText={setDeviceId}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      
      <View style={styles.statusContainer}>
        <Text style={styles.label}>Status:</Text>
        <Text 
          style={[
            styles.statusText, 
            isConnected ? styles.connectedStatus : styles.disconnectedStatus
          ]}
        >
          {connectionStatus}
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        {!isConnected ? (
          <TouchableOpacity 
            style={[styles.button, styles.connectButton]} 
            onPress={connectToServer}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <>
            <TouchableOpacity 
              style={[styles.button, styles.testButton]} 
              onPress={sendTestPing}
            >
              <Text style={styles.buttonText}>Send Test Ping</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.disconnectButton]} 
              onPress={disconnect}
            >
              <Text style={styles.buttonText}>Disconnect</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
      
      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Connection Logs:</Text>
        <ScrollView 
          style={styles.logScroll}
          ref={(ref) => { this.scrollView = ref; }}
          onContentSizeChange={() => {
            this.scrollView && this.scrollView.scrollToEnd({ animated: true });
          }}
        >
          {logs.map((entry, index) => (
            <Text key={index} style={styles.logEntry}>{entry}</Text>
          ))}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#121212',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginVertical: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    color: 'white',
    borderRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  statusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  connectedStatus: {
    color: '#4CAF50',
  },
  disconnectedStatus: {
    color: '#F44336',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  testButton: {
    backgroundColor: '#2196F3',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  logContainer: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 4,
    padding: 8,
  },
  logTitle: {
    fontSize: 16,
    color: 'white',
    marginBottom: 8,
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

export default ConnectionTester;
