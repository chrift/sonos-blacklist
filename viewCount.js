/**
 * Created by ChrisCheshire on 15/10/15.
 */

'use strict';

var fs   = require('fs'),
    path = require('path');

var counterFile = path.join(__dirname, 'counter.json');

var counter = JSON.parse(fs.readFileSync(counterFile).toString()) || {};

counter;