'use strict';

var Server = require('../server.js');
var Client = require('../client.js');

var server = new Server();
var left = new Client();
var right = new Client();

left.insert('cars', 'subaru', {color: 'red'});
server.writeMessage(left.firstMessage());
left.advanceMessage();

server.get(0);
