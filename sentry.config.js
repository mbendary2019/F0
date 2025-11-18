// Sentry Configuration for Multi-Platform
// Web + Desktop + Mobile

module.exports = {
  // Organization slug
  org: process.env.SENTRY_ORG || 'your-org',
  
  // Project slug
  project: process.env.SENTRY_PROJECT || 'f0-platform',
  
  // Auth token
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Silent mode in CI
  silent: process.env.CI === 'true',
  
  // Disable telemetry
  telemetry: false,
  
  // Source maps
  widenClientFileUpload: true,
  hideSourceMaps: true,
  
  // Error monitoring settings
  errorReporting: {
    // Sample rate for error events
    sampleRate: 1.0,
    
    // Sample rate for session events
    sessionSampleRate: 0.1,
    
    // Tracing
    tracesSampleRate: 0.1
  },
  
  // Environment-specific configuration
  environments: {
    development: {
      enabled: false
    },
    production: {
      enabled: true,
      beforeSend(event, hint) {
        // Filter out certain errors
        if (event.exception) {
          const error = hint.originalException;
          
          // Ignore network errors
          if (error && error.message && error.message.includes('NetworkError')) {
            return null;
          }
        }
        
        return event;
      }
    }
  }
};


