'use strict';

var Promise = require('promise');

module.exports = Server;
function Server() {
  this.updates = [];
  this.waiting = [];
}

Server.prototype.writeUpdate = function (update) {
  if (this.updates.some(function (u) { return u.guid === update.guid; })) {
    return;
  }

  update.index = this.updates.length;
  this.updates.push(update);
  this.waiting.forEach(function (resolve) {
    resolve(update);
  });
};

Server.prototype.getInitial = function () {
  return this.updates;
};
Server.prototype.getUpdate = function (index) {
  if (this.updates.length > index) return Promise.resolve(this.updates[index]);
  return new Promise(function (resolve) {
    this.waiting.push(resolve);
    setTimeout(function () {
      resolve({});
    }, 30000);
  }.bind(this));
};
