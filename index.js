const fs = require('fs'),
  path = require('path');

const sonos = require('sonos');

const Debug = require('debug'),
  _ = require('lodash'),
  moment = require('moment');

const debug = Debug('blacklist:index');

let counterFile,
  counter,
  counterChanged = false;

const blacklistFilePath = path.join(__dirname, 'blacklist.json'),
  devices = [];

_setCounter();

debug('Discovering sonos devices...');

debug(blacklistFilePath);

fs.watchFile(blacklistFilePath, () => {
  debug('Blacklist change detected');

  devices.forEach(device =>
    device.currentTrack((err, track) => checkSongInBlacklist(device, track))
  );
});

sonos.search((device) => {
  devices.push(device);

  debug(`Sonos device found with ip ${device.host}`);

  device.on('TrackChanged', track => checkSongInBlacklist(device, track));
});

function checkSongInBlacklist(device, song) {
  if (!song || !song.title) {
    return;
  }

  const sdebug = Debug(`blacklist:${device.host}`);

  sdebug(song.title);

  const blacklist = _getBlacklist();

  let foundInBlacklist = false;

  _.each(blacklist, function (track) {
    if (foundInBlacklist) //Don't go any further if we've already found this song in our blacklist
    {
      return;
    }

    if (typeof track === 'object') {
      let matchSongBlacklist = false,
        matchArtistBlacklist = false;

      if (!track.title) {
        matchSongBlacklist = true;
      } else if (track.title && song.title) {
        const titleRGX = new RegExp(escapeRegExp(track.title), 'gi');

        matchSongBlacklist = !!song.title.match(titleRGX);
      }

      if (!track.artist) {
        matchArtistBlacklist = true;
      } else if (track.artist && song.artist) {
        const artistRGX = new RegExp(escapeRegExp(track.artist), 'gi');

        matchArtistBlacklist = !!song.artist.match(artistRGX);
      }

      //If it passed all of our tests, blacklist the shit out of it!
      if (matchSongBlacklist && matchArtistBlacklist) {
        sdebug('found in blacklist', song.title);
        foundInBlacklist = true;
      }
    } else {
      const rgx = new RegExp(escapeRegExp(track), 'gi');

      if (song.title.match(rgx)) {
        foundInBlacklist = true;
      }
    }

    if (!foundInBlacklist) {
      return;
    }

    sdebug('About to skip');

    foundInBlacklist = true;

    incrementSong(song, true);

    device.next(function (err, nextResponse) {
      sdebug('next: ', err, nextResponse);

      if (err) {
        device.pause(function (err, response) {
          sdebug('pause: ', err, response);
        });
      }
    });
  });

  if (!foundInBlacklist) {
    incrementSong(song);

    _saveCounter();
  }
}

function incrementSong(songObj, skipped) {
  counterChanged = true;

  const songCounter = counter[songObj.title + ' - ' + songObj.artist] = counter[songObj.title + ' - ' + songObj.artist] || songObj;

  songCounter.skipped = songCounter.skipped || 0;
  songCounter.count = songCounter.count || 0;

  if (skipped) {
    songCounter.skipped++;
  } else {
    songCounter.count++;
  }
}

function _getTodaysCounterPath() {
  return path.join(__dirname, 'counters', moment()
    .startOf('day')
    .format() + '.json');
}

function _setCounter() {
  counterFile = _getTodaysCounterPath();

  try {
    fs.statSync(counterFile);
  } catch (e) {
    fs.writeFileSync(counterFile, '{}');
  }

  try {
    counter = JSON.parse(fs.readFileSync(counterFile)
      .toString());
  } catch (e) {
    counter = {};
  }
}

function _saveCounter() {
  if (counterChanged) {
    counterChanged = false;

    fs.writeFileSync(counterFile, JSON.stringify(counter));

    _setCounter();
  }
}

function _getBlacklist() {
  return JSON.parse(fs.readFileSync(blacklistFilePath)
    .toString()) || [];
}

function escapeRegExp(str) {
  return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
}

debug('Watching...');

process.stdin.resume();
