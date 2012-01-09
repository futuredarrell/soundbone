# soundbone

## What?

This is a single-page application running on backbone, backbone-localStorage adapter, zepto and the soundcloud js sdk.  This is a very early prototype of this concept and as such forking at this time is not recommended.  Feel free once I actually add a version number down the road :)

Demo here: http://futuredarrell.github.com/soundbone/

## Features

- Transitions between tracks from track to track or stream to track
- You can swipe left or right on the area between the track controls and comments on a track page to move between the tracks. This uses the default zepto swipe methods and there is an obvious delay when making this gesture.
- You can touch in the waveform and scrub through the track.

## Caveats

- Behavior of track scrubbing is slightly erratic because soundmanager in html5 often returns a null for the stream duration property. If this is happening when you try to scrub the track marker will just return to the current position.  Refresh the page and try again.
- It has only really been tested on the iOS Simulator, an iPhone 4 running iOS 5, and an iPad running iOS 5.
- It has been tested a bit in the latest version of Android in the Android emulator, but the emulator is slow to the point of being unuseable.
- The webkit transitions can get slightly out of sync.  In the future we could use the same setTimeout that updates the time to readjust the track position marker
- There are definitely some better patterns to put in use regarding views and subviews, but those can be implemented later

## ToDos

- Everything. :)
- I want to make this explore your own soundcloud network and load tracks from your followers and those you are following like a kind of shuffle for soundcloud
- Auth, commenting, etc, etc.
- A real build process to minimise and pack assets.  There is a script in js/templates called builder that you can run with node.js and it will get put the *.jst files into a single file but it needs to be rebuilt.  I hacked it together quickly to save time.
- Create a view subclass called lazy view that is able to update itself in according to ajax calls and lazily-load data and assets
- Remove the local storage adapter and override backbone.sync to access the soundcloud api with local or session storage checks

