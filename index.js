var fs   = require('fs'),
    path = require('path');

var Sonos = require('sonos').Sonos;

var _      = require('underscore'),
    async  = require('async'),
    moment = require('moment');

var ips = [
	{
		ip: '10.41.10.142', //Oval office
		sonos: null,
		currentTrack: null
	},
	{
		ip: '10.41.10.124', //Engine room
		sonos: null,
		currentTrack: null
	},
	{
		ip: '10.41.10.104', //Mezz
		sonos: null,
		currentTrack: null
	}
];

var counterFile,
    counter;

_setCounter();

var counterChanged = false;

_.each(ips, function (obj) {
	obj.sonos = new Sonos(obj.ip, 1400)
});

async.forever(function (nextForever) {
	var blacklist = _getBlacklist();

	async.each(ips, function (obj, nextIP) {
		obj.sonos.currentTrack(function (err, response) {
			if (!response || !response.title)
				return nextIP();

			console.log(response.title);

			var foundInBlacklist = false;

			_.each(blacklist, function (track) {
				if (foundInBlacklist) //Don't go any further if we've already found this song in our blacklist
					return;

				if (typeof track === 'object') {
					var matchSongBlacklist = false,
					    matchArtistBlacklist = false;

					if (track.title && response.title) {
						var titleRGX = new RegExp(escapeRegExp(track.title), 'gi');

						if (response.title.match(titleRGX))
							matchSongBlacklist = true;
					}

					if (track.artist && response.artist) {
						var artistRGX = new RegExp(escapeRegExp(track.artist), 'gi');

						if (response.artist.match(artistRGX))
							matchArtistBlacklist = true;
					}

					//If it passed all of our tests, blacklist the shit out of it!
					if (matchSongBlacklist && matchArtistBlacklist) {
						console.log('found in blacklist', response.title);
						foundInBlacklist = true;
					}
				} else {
					var rgx = new RegExp(escapeRegExp(track), 'gi');

					if (response.title.match(rgx))
						foundInBlacklist = true;
				}

				if (!foundInBlacklist)
					return;

				console.log('About to skip');

				foundInBlacklist = true;

				incrementSong(response, true);

				obj.sonos.next(function (err, nextResponse) {
					console.log('next: ', err, nextResponse);

					if (err) {
						obj.sonos.pause(function (err, response) {
							console.log('pause: ', err, response);

							return setTimeout(nextIP, 8000);
						})
					} else {
						return setTimeout(nextIP, 8000);
					}
				});
			});

			if (!foundInBlacklist) {
				if (obj.currentTrack && (obj.currentTrack.title !== response.title || obj.currentTrack.artist !== response.artist))
					incrementSong(response);

				obj.currentTrack = response;

				return nextIP();
			}
		});
	}, function () {
		_saveCounter();

		setTimeout(nextForever, 2000);
	});
}, function () {
	console.log('error');
});

function incrementSong(songObj, skipped) {
	counterChanged = true;

	var songCounter = counter[songObj.title + ' - ' + songObj.artist] = counter[songObj.title + ' - ' + songObj.artist] || songObj;

	songCounter.skipped = songCounter.skipped || 0;
	songCounter.count = songCounter.count || 0;

	if (skipped) {
		songCounter.skipped++;
	} else {
		songCounter.count++;
	}
}

function _getTodaysCounterPath() {
	return path.join(__dirname, 'counters', moment().startOf('day').format() + '.json');
}

function _setCounter() {
	counterFile = _getTodaysCounterPath();

	try {
		fs.statSync(counterFile)
	} catch (e) {
		fs.writeFileSync(counterFile, '{}');
	}

	try {
		counter = JSON.parse(fs.readFileSync(counterFile).toString());
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
	return JSON.parse(fs.readFileSync(path.join(__dirname, 'blacklist.json')).toString()) || [];
}

function escapeRegExp(str) {
	return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

console.log('Watching...');

process.stdin.resume();