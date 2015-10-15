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
var todaysDate = moment().startOf('day').format();

var counterFile = path.join(__dirname, 'counter.json');

var counter = JSON.parse(fs.readFileSync(counterFile).toString()) || {};

var counterChanged = false;

counter[todaysDate] = counter[todaysDate] || {};

_.each(ips, function (obj) {
	obj.sonos = new Sonos(obj.ip, 1400)
});

var blacklist = [
	'feel my face',
	'what do you mean',
	'locked away',
	'hotline bling',
	'on my mind',
	'easy love',
	'nae nae',
	'shut up and dance',
	'black magic',
	'cheerleader',
	'want to want me'
];

async.forever(function (nextForever) {
	async.each(ips, function (obj, nextIP) {
		obj.sonos.currentTrack(function (err, response) {
			if (!response || !response.title)
				return nextIP();

			console.log(response.title);

			var foundInBlacklist = false;

			_.each(blacklist, function (track) {
				var rgx = new RegExp(track, 'gi');

				if (foundInBlacklist || !response.title.match(rgx))
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
		setTimeout(nextForever, 2000);

		if (counterChanged) {
			counterChanged = false;

			fs.writeFileSync(counterFile, JSON.stringify(counter));
		}
	});
}, function () {
	console.log('error');
});

function incrementSong(songObj, skipped) {
	counterChanged = true;

	counter[todaysDate][songObj.title + ' - ' + songObj.artist] = counter[todaysDate][songObj.title + ' - ' + songObj.artist] || songObj;

	counter[todaysDate][songObj.title + ' - ' + songObj.artist].skipped = counter[todaysDate][songObj.title + ' - ' + songObj.artist].skipped || 0;
	counter[todaysDate][songObj.title + ' - ' + songObj.artist].count = counter[todaysDate][songObj.title + ' - ' + songObj.artist].count || 0;

	if (skipped) {
		counter[todaysDate][songObj.title + ' - ' + songObj.artist].skipped++;
	} else {
		counter[todaysDate][songObj.title + ' - ' + songObj.artist].count++;
	}
}

console.log('Watching...');

process.stdin.resume();