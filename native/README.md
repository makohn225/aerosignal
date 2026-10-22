# AeroSignal phone and tablet apps

The iOS and Android apps are the same web app (built into `../dist`) running inside a
[Capacitor 7](https://capacitorjs.com) shell, plus one native plugin:

- `plugins/aero-gdl90`: listens on UDP port 4000 for GDL 90 messages from a portable ADS-B
  receiver (Stratux, Sentry, Stratus, SkyEcho and others) and hands each datagram to the web app.
  The decoder, traffic layer and simulator are in `../p129.js`.

## What a native app adds over the website

- ADS-B traffic and receiver GPS (a website cannot open a UDP socket).
- App store listing and install.
- Room for large offline chart downloads (planned; the website keeps tiles along the route).

## Build

Needs Node 20 or later. Android needs Android Studio (JDK 21, SDK 35). iOS needs a Mac with
Xcode 16, or a cloud build service (Codemagic or similar), and an Apple Developer account.

```
cd native
npm install
npm run sync        # builds the web app into native/www and copies it into both projects
npx cap open android
npx cap open ios
```

Set the app icon and splash screen in Android Studio and Xcode, then sign with your own keys.
Nothing here has been compiled yet: the projects were generated and the plugin written on Linux
without the Android SDK or Xcode, so expect to fix small build errors on the first run.

## Testing ADS-B

1. In the app, open Maps, Tools, Traffic simulator to check the display without a receiver.
2. On the ground, join the receiver's Wi-Fi, open Tools, ADS-B traffic. iOS asks for Local
   Network permission the first time.
3. Most receivers send to port 4000. Stratux needs the device's IP to be a DHCP client of the
   Stratux network (the default).

Traffic is for awareness only and is not a collision avoidance system.
