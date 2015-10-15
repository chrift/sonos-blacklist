var Sonos = require('sonos').Sonos;

var _     = require('underscore'),
    async = require('async');

var ips = [
	{
		ip: '10.41.10.142', //Oval office
		sonos: null
	},
	{
		ip: '10.41.10.124', //Engine room
		sonos: null
	},
	{
		ip: '10.41.10.104', //Mezz
		sonos: null
	}
];

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
	'nae nae'
];

async.forever(function(nextForever) {
	async.each(ips, function (obj, nextIP) {
		obj.sonos.currentTrack(function (err, response) {
			if (!response || !response.title)
				return nextIP();

			console.log(response.title);

			var found = false;

			_.each(blacklist, function (track) {
				var rgx = new RegExp(track, 'gi');

				if (found || !response.title.match(rgx))
					return;

				console.log('About to skip');

				found = true;

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

			if (!found)
				return nextIP();
		});
	}, function () {
		setTimeout(nextForever, 2000);
	});
}, function(){
	console.log('error');
});

console.log('Watching...');

process.stdin.resume();