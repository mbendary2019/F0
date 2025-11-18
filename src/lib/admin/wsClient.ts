/**
 * Admin WebSocket Client
 * Connects to real-time gateway for live updates
 */

type Events = 'hello' | 'audit_new' | 'metrics_update' | 'alert_triggered';

type EventPayload = {
  hello: { ok: boolean; uid: string };
  audit_new: any;
  metrics_update: any;
  alert_triggered: any;
};

type EventCallback<E extends Events> = (payload: EventPayload[E]) => void;

/**
 * WebSocket client for admin real-time updates
 */
export class AdminWS {
  private ws?: WebSocket;
  private url: string;
  private listeners = new Map<Events, Set<(p: any) => void>>();
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;

  constructor(url: string) {
    // Ensure URL ends with /admin-live
    this.url = url.endsWith('/admin-live') ? url : `${url}/admin-live`;
    
    // Initialize listener sets
    const eventTypes: Events[] = ['hello', 'audit_new', 'metrics_update', 'alert_triggered'];
    for (const e of eventTypes) {
      this.listeners.set(e, new Set());
    }
  }

  /**
   * Connect to WebSocket gateway
   */
  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[AdminWS] Already connected');
      return;
    }

    try {
      console.log('[AdminWS] Connecting to:', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[AdminWS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const { event: eventType, payload, ts } = JSON.parse(event.data);
          console.log('[AdminWS] Received:', eventType, 'at', new Date(ts).toISOString());
          
          const listeners = this.listeners.get(eventType as Events);
          if (listeners) {
            listeners.forEach(fn => {
              try {
                fn(payload);
              } catch (err) {
                console.error('[AdminWS] Listener error:', err);
              }
            });
          }
        } catch (err) {
          console.error('[AdminWS] Message parse error:', err);
        }
      };

      this.ws.onerror = (error) => {
        console.error('[AdminWS] WebSocket error:', error);
      };

      this.ws.onclose = (event) => {
        console.log('[AdminWS] Disconnected. Code:', event.code, 'Reason:', event.reason);
        this.scheduleReconnect();
      };
    } catch (err) {
      console.error('[AdminWS] Connection error:', err);
      this.scheduleReconnect();
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[AdminWS] Max reconnect attempts reached');
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    console.log(`[AdminWS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Subscribe to an event
   */
  on<E extends Events>(event: E, callback: EventCallback<E>): () => void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.add(callback);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(event);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }

  /**
   * Close connection
   */
  close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }

    console.log('[AdminWS] Closed');
  }

  /**
   * Get connection state
   */
  getState(): 'connecting' | 'open' | 'closing' | 'closed' {
    if (!this.ws) return 'closed';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'connecting';
      case WebSocket.OPEN: return 'open';
      case WebSocket.CLOSING: return 'closing';
      case WebSocket.CLOSED: return 'closed';
      default: return 'closed';
    }
  }
}

/**
 * React hook for admin live updates
 * Must be used in a client component
 */
export function createUseAdminLive() {
  // Import React hooks dynamically
  let useState: any, useEffect: any;
  try {
    const React = require('react');
    useState = React.useState;
    useEffect = React.useEffect;
  } catch {
    // React not available
    return function useAdminLive() {
      return { live: 'offline' as const, lastEvent: 0 };
    };
  }

  return function useAdminLive() {
    if (typeof window === 'undefined') {
      return { live: 'offline' as const, lastEvent: 0 };
    }

    const [live, setLive] = useState('offline');
    const [lastEvent, setLastEvent] = useState(0);

    useEffect(() => {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL;
      if (!wsUrl) {
        console.warn('[useAdminLive] NEXT_PUBLIC_WS_URL not configured');
        return;
      }

      const ws = new AdminWS(wsUrl);
      ws.connect();

      const unsubHello = ws.on('hello', () => {
        setLive('online');
        setLastEvent(Date.now());
      });

      const unsubMetrics = ws.on('metrics_update', () => {
        setLastEvent(Date.now());
      });

      const unsubAudit = ws.on('audit_new', () => {
        setLastEvent(Date.now());
      });

      const unsubAlert = ws.on('alert_triggered', () => {
        setLastEvent(Date.now());
      });

      // Check connection state periodically
      const interval = setInterval(() => {
        const state = ws.getState();
        setLive(state === 'open' ? 'online' : 'offline');
      }, 3000);

      return () => {
        unsubHello();
        unsubMetrics();
        unsubAudit();
        unsubAlert();
        clearInterval(interval);
        ws.close();
      };
    }, []);

    return { live: live as 'online' | 'offline', lastEvent };
  };
}

