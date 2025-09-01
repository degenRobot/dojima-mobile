import { logInfo, logWarn, logError, logDebug } from '../../utils/logger';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

interface WebSocketMessage {
  type: string;
  topic?: string;
  data?: any;
}

interface SubscriptionCallback {
  (data: any): void;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private subscriptions: Map<string, Set<SubscriptionCallback>>;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private connectionState: ConnectionState = 'disconnected';
  private stateChangeCallbacks: Set<(state: ConnectionState) => void> = new Set();
  private messageQueue: WebSocketMessage[] = [];
  private isReconnecting = false;

  constructor(url?: string) {
    this.url = url || '';
    this.subscriptions = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect(url?: string): void {
    if (url) {
      this.url = url;
    }

    if (!this.url) {
      logError('WebSocketManager', 'No URL provided');
      return;
    }

    if (this.ws?.readyState === WebSocket.OPEN) {
      logWarn('WebSocketManager', 'Already connected');
      return;
    }

    this.setConnectionState('connecting');
    logInfo('WebSocketManager', 'Connecting to WebSocket', { url: this.url });

    try {
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      logError('WebSocketManager', 'Failed to create WebSocket', { error });
      this.setConnectionState('error');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    logInfo('WebSocketManager', 'Disconnecting');
    this.isReconnecting = false;
    this.clearHeartbeat();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    this.setConnectionState('disconnected');
    this.messageQueue = [];
  }

  /**
   * Subscribe to a topic
   */
  subscribe(topic: string, callback: SubscriptionCallback): () => void {
    logDebug('WebSocketManager', 'Subscribing to topic', { topic });
    
    if (!this.subscriptions.has(topic)) {
      this.subscriptions.set(topic, new Set());
      
      // Send subscription message if connected
      if (this.isConnected()) {
        this.send({
          type: 'subscribe',
          topic,
        });
      }
    }
    
    this.subscriptions.get(topic)!.add(callback);
    
    // Return unsubscribe function
    return () => this.unsubscribe(topic, callback);
  }

  /**
   * Unsubscribe from a topic
   */
  unsubscribe(topic: string, callback: SubscriptionCallback): void {
    const callbacks = this.subscriptions.get(topic);
    
    if (callbacks) {
      callbacks.delete(callback);
      
      if (callbacks.size === 0) {
        this.subscriptions.delete(topic);
        
        // Send unsubscribe message if connected
        if (this.isConnected()) {
          this.send({
            type: 'unsubscribe',
            topic,
          });
        }
      }
    }
  }

  /**
   * Send a message
   */
  send(message: WebSocketMessage): void {
    if (this.isConnected() && this.ws) {
      try {
        this.ws.send(JSON.stringify(message));
        logDebug('WebSocketManager', 'Message sent', { message });
      } catch (error) {
        logError('WebSocketManager', 'Failed to send message', { error, message });
        this.messageQueue.push(message);
      }
    } else {
      logWarn('WebSocketManager', 'Not connected, queuing message', { message });
      this.messageQueue.push(message);
    }
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes
   */
  onStateChange(callback: (state: ConnectionState) => void): () => void {
    this.stateChangeCallbacks.add(callback);
    return () => this.stateChangeCallbacks.delete(callback);
  }

  /**
   * Setup WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      logInfo('WebSocketManager', 'Connected');
      this.setConnectionState('connected');
      this.reconnectAttempts = 0;
      this.setupHeartbeat();
      this.resubscribe();
      this.flushMessageQueue();
    };

    this.ws.onclose = (event) => {
      logInfo('WebSocketManager', 'Disconnected', { code: event.code, reason: event.reason });
      this.setConnectionState('disconnected');
      this.clearHeartbeat();
      
      if (!event.wasClean && this.isReconnecting !== false) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      logError('WebSocketManager', 'WebSocket error', { error });
      this.setConnectionState('error');
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data) as WebSocketMessage;
        this.handleMessage(message);
      } catch (error) {
        logError('WebSocketManager', 'Failed to parse message', { error, data: event.data });
      }
    };
  }

  /**
   * Handle incoming message
   */
  private handleMessage(message: WebSocketMessage): void {
    logDebug('WebSocketManager', 'Received message', { message });

    switch (message.type) {
      case 'pong':
        // Heartbeat response
        break;
        
      case 'update':
        if (message.topic && message.data) {
          this.notifySubscribers(message.topic, message.data);
        }
        break;
        
      case 'error':
        logError('WebSocketManager', 'Server error', { message });
        break;
        
      default:
        // Handle other message types
        if (message.topic) {
          this.notifySubscribers(message.topic, message);
        }
    }
  }

  /**
   * Notify subscribers of a topic
   */
  private notifySubscribers(topic: string, data: any): void {
    const callbacks = this.subscriptions.get(topic);
    
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          logError('WebSocketManager', 'Subscriber callback error', { topic, error });
        }
      });
    }
  }

  /**
   * Setup heartbeat
   */
  private setupHeartbeat(): void {
    this.clearHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      if (this.isConnected()) {
        this.send({ type: 'ping' });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Clear heartbeat
   */
  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logError('WebSocketManager', 'Max reconnection attempts reached');
      this.setConnectionState('error');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    logInfo('WebSocketManager', `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    
    setTimeout(() => {
      if (this.isReconnecting) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Resubscribe to all topics after reconnection
   */
  private resubscribe(): void {
    const topics = Array.from(this.subscriptions.keys());
    
    if (topics.length > 0) {
      this.send({
        type: 'subscribe',
        data: { topics },
      });
      logInfo('WebSocketManager', 'Resubscribed to topics', { topics });
    }
  }

  /**
   * Flush message queue
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length > 0) {
      logInfo('WebSocketManager', `Flushing ${this.messageQueue.length} queued messages`);
      
      const messages = [...this.messageQueue];
      this.messageQueue = [];
      
      messages.forEach(message => this.send(message));
    }
  }

  /**
   * Set connection state
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.stateChangeCallbacks.forEach(callback => {
        try {
          callback(state);
        } catch (error) {
          logError('WebSocketManager', 'State change callback error', { error });
        }
      });
    }
  }
}