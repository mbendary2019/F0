# F0 Mobile - Flutter App

Autonomous Ops Mobile Client built with Flutter.

## Setup

### Prerequisites

- Flutter SDK >= 3.0.0
- Dart SDK >= 3.0.0
- Android Studio (for Android)
- Xcode (for iOS)

### Install Dependencies

```bash
cd apps/mobile
flutter pub get
```

## Development

### Run on Android Emulator

```bash
flutter run
```

### Run with Custom API Endpoint

```bash
flutter run --dart-define=F0_API=https://your-api.com/api
```

### Build APK (Debug)

```bash
flutter build apk --debug
```

### Build APK (Release)

```bash
flutter build apk --release
```

## Architecture

```
lib/
├── main.dart           # App entry point
├── screens/            # UI screens (TODO)
├── widgets/            # Reusable widgets (TODO)
├── services/           # API services (TODO)
└── models/             # Data models (TODO)
```

## Features

### Current

- ✅ Basic UI with Material 3
- ✅ API health check
- ✅ HTTP client integration
- ✅ Dark theme

### TODO (Future Phases)

- [ ] Firebase Auth integration
- [ ] Deep linking (f0:// scheme)
- [ ] Push notifications
- [ ] Ops dashboard
- [ ] Command execution
- [ ] Real-time telemetry
- [ ] Policy monitoring
- [ ] Guardrail status
- [ ] Manual overrides

## Deep Linking

Future setup for `f0://` scheme:

```dart
// Android: android/app/src/main/AndroidManifest.xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="f0" />
</intent-filter>

// iOS: ios/Runner/Info.plist
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>f0</string>
    </array>
  </dict>
</array>
```

## Firebase Setup

TODO: Add `google-services.json` (Android) and `GoogleService-Info.plist` (iOS)

## Testing

```bash
# Run tests
flutter test

# Run with coverage
flutter test --coverage

# Run integration tests
flutter test integration_test
```

## Integration with Phase 33.3

The mobile app will integrate with autonomous ops:

- View real-time policy decisions
- Monitor guardrail status
- Execute approved commands
- View telemetry dashboards
- Manual override interface (admin-only)
- Receive push notifications for critical events

## Performance

- Uses HTTP/2 for API calls
- Implements connection pooling
- Caches API responses
- Optimizes for low-bandwidth scenarios

## Next Steps

1. [ ] Add Firebase Auth
2. [ ] Implement deep linking
3. [ ] Create ops dashboard screen
4. [ ] Add push notifications
5. [ ] Implement state management
6. [ ] Add offline support
7. [ ] Create CI/CD pipeline
8. [ ] Publish to app stores


