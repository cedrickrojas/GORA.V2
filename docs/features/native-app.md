# Native Android and iOS app

The Ionic client uses Capacitor 8 with bundled assets in `mobile/dist`. Native source
is versioned in `mobile/android` and `mobile/ios`. Run the commands below from
the repository root containing `mobile/`, `server/`, and `vercel.json`.

## API connection

Create the ignored `mobile/.env.native`:

```dotenv
VITE_API_BASE_URL=https://gorav2.vercel.app
```

Use the public origin of the existing GORA deployment, without `/api/v1`. The phone
must be able to reach it over HTTPS. Native builds validate this setting; browser
builds still support same-origin API routes and the local Vite proxy.

`CapacitorHttp` is enabled for native `fetch`/XHR networking to the separately
hosted API. The deployed API currently omits an `Access-Control-Allow-Origin`
header for `https://localhost`; native HTTP avoids that browser CORS restriction.
If you disable native HTTP, add `https://localhost` (Android) and
`capacitor://localhost` (iOS) to the API's `CORS_ORIGIN` and redeploy it.

Configure `LIVE_TURN_URLS`
and `LIVE_TURN_SECRET` on the API for calls between restrictive mobile networks;
see [TURN setup](turn-setup.md). Do not put TURN secrets in the client environment.

## Android

Install Node 22+, Android Studio 2025.2.1+, SDK platform 36, and its build tools.
Use Android Studio's bundled JDK 21 (or newer compatible JDK).

```powershell
npm install --prefix mobile
npm run mobile:android
npm run mobile:android:open
```

In Android Studio, run on a connected phone or build an APK using **Build >
Generate App Bundles or APKs > Generate APKs**. For an already configured Android
toolchain, `mobile/android/gradlew.bat -p mobile/android assembleDebug` builds a
debug APK at `mobile/android/app/build/outputs/apk/debug/app-debug.apk`.
Run `npm run mobile:android` again after frontend changes before rebuilding.

The app ID is `com.gora.app`. Keep it consistent with any existing store listing
before publishing. Release signing is configured separately in Android Studio.

## iOS

On a Mac with Xcode 26+, run `npm run mobile:ios`, then
`npm run ios:open --prefix mobile`. Select your signing team and a physical device
in Xcode. The project uses Swift Package Manager. Windows can maintain the source
but cannot compile or sign an iOS app.

## Camera, microphone, and verification

Location actions use `@capacitor/geolocation` in the bundled app and browser
geolocation on the web. Android declares coarse and fine location permissions;
iOS includes the required location usage descriptions. Location permission is
requested only after a location action. Approximate location is accepted, and a
denied or unavailable reading opens the map for manual selection. The map center
is saved only after the user selects it and confirms. Rebuild and reinstall the
native app after syncing so the plugin and permissions are included.

The Android launcher uses the supplied artwork in `mobile/resources/android-icon.png`.
Run `mobile/scripts/generate-android-icons.ps1` in PowerShell to regenerate the
standard, round, and adaptive launcher icons for all five screen densities.

Go Live and video calls request camera + microphone through `getUserMedia`; voice
calls request microphone only. Capacitor's built-in WebView bridge requests Android
runtime permissions. Android declares `CAMERA`, `RECORD_AUDIO`, and
`MODIFY_AUDIO_SETTINGS`; iOS declares camera and microphone usage descriptions.
There is no still-photo Camera plugin in the streaming path: WebRTC needs live
`MediaStream` tracks. Permissions are requested after a media action, not at launch.

On two physical devices with different accounts, verify:

1. Open Go Live, allow both permissions, and check the preview and viewer sound.
2. Make/answer a voice call; confirm no camera permission is required.
3. Make/answer a video call and toggle microphone/camera.
4. Deny a permission, check the message, then grant it in app settings and retry.
5. End calls/broadcasts and navigate away; camera/microphone indicators must turn off.
6. Repeat over Wi-Fi and mobile data to verify the deployed TURN relay.

Calls and broadcasts currently require the app to stay open. Incoming calls are
polled while the app is visible; background/terminated-app ringing needs push and
native calling integration, which is separate from media permissions.

References: [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup),
[Capacitor configuration](https://capacitorjs.com/docs/config),
[Capacitor native HTTP](https://capacitorjs.com/docs/apis/http),
[Android WebView permission bridge](https://github.com/ionic-team/capacitor/blob/8.6.0/android/capacitor/src/main/java/com/getcapacitor/BridgeWebChromeClient.java).
