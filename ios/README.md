# Zeitwerk iOS / CarPlay widget prototype

This folder is an **isolated, native iOS proof of concept**. It does not alter the existing PWA, Supabase schema, web clock, or production data.

## Requirements
- macOS, current Xcode with iOS 26 SDK, and [XcodeGen](https://github.com/yonaskolb/XcodeGen).
- Apple signing team for physical devices.
- iOS 26+ and a compatible CarPlay setup for on-car testing.

## Generate and run
```sh
cd ios
xcodegen generate
open ZeitwerkNative.xcodeproj
```
Select your signing team for both targets and provision the **same App Group** `group.de.zeitwerk.native` on both. Change bundle identifiers and the group name consistently if your Apple account requires it. Build the `ZeitwerkNative` target on an iPhone. Add the small widget on iPhone, then check CarPlay widget availability on a supported car.

## Scope / limitations
- The app provides **demo-only** start/stop buttons that write a snapshot to App Group UserDefaults. They **do not create, stop, or modify** entries in the web app or Supabase.
- The widget is **read-only**. There are no interactive CarPlay buttons in this MVP. The appearance and update cadence are controlled by iOS/CarPlay; the timer is not guaranteed to update every second on a car screen.
- App Groups are required for host/extension sharing. There are no credentials or secrets in this project.
- Next phase: implement secure Supabase authentication, read the existing account's clock snapshot, map timestamps carefully, and add explicit conflict-safe App Intents for start/stop. Test multi-device synchronization before enabling writes.
- Never copy a service-role key into a client app. Do not ship the demo as a production time tracker.

## Manual acceptance tests
1. Start the demo clock in the native app and confirm the iPhone widget changes.
2. End the demo and confirm the widget returns to idle.
3. Restart the app and confirm the shared snapshot persists.
4. Test on CarPlay with iOS 26+; verify legibility and widget availability.
5. Confirm the existing Zeitwerk web app is entirely unaffected.
