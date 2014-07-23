'use strict';

var assert = require('assert');
var clone = require('clone');
var match = require('mongomatch');

var ObjectId = require('./lib/object-id');
var applyUpdate = require('./lib/apply-update');

module.exports = Client;
function Client(collections, initial) {
  initial = clone(initial);
  var state = initial && initial.action === 'initialize' ? initial.state : {};
  for (var i = 0; i < collections.length; i++) {
    this[collections[i]] = new ClientCollection(collections[i], state[collections[i]] || [], this._emitUpdate.bind(this), this._addedUpdate.bind(this));
  }
  this.next = initial && initial.action === 'initialize' ? initial.next : null;
  this._updateHandlers = [];
  this._pendingChanges = [];
  this._localChangeHandlers = [];
}
Client.prototype._addedUpdate = function (update) {
  this._pendingChanges.push(update);
  var firstError;
  for (var i = 0; i < this._localChangeHandlers.length; i++) {
    try {
      this._localChangeHandlers[i]();
    } catch (ex) {
      firstError = firstError || ex;
    }
  }
  if (firstError) {
    setTimeout(function () {
      throw firstError;
    }, 0);
  }
};
Client.prototype._emitUpdate = function () {
  var firstError;
  for (var i = 0; i < this._updateHandlers.length; i++) {
    try {
      this._updateHandlers[i]();
    } catch (ex) {
      firstError = firstError || ex;
    }
  }
  if (firstError) {
    setTimeout(function () {
      throw firstError;
    }, 0);
  }
};
Client.prototype.onUpdate = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._updateHandlers.push(fn);
};
Client.prototype.onLocalChange = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._localChangeHandlers.push(fn);
};
Client.prototype.writeUpdate = function (update) {
  if (update.next !== undefined) {
    this.next = update.next;
  }
  this[update.collection].writeUpdate(update, '_remote');
};

Client.prototype.getFirstLocalChange = function () {
  if (this._pendingChanges.length === 0) {
    throw new Error('No changes are pending');
  }
  return this._pendingChanges[0];
};
Client.prototype.setFirstLocalChangeHandled = function () {
  if (this._pendingChanges.length === 0) {
    throw new Error('No changes are pending');
  }
  this._pendingChanges.shift();
};
Client.prototype.getNumberOfLocalChanges = function () {
  return this._pendingChanges.length;
};

function ClientCollection(name, data, emitUpdate, addedUpdate) {
  this._name = name;
  this._emitUpdate = emitUpdate;
  this._addedUpdate = addedUpdate;
  this._remote = data;
  this._local = [];
  this._updates = [];
}
ClientCollection.prototype.find = function (query) {
  if (!query) return clone(this._local);
  return clone(this._local.filter(match.bind(null, query)));
};
ClientCollection.prototype.writeUpdate = function (update, store) {
  if (update.action === 'noop') return;
  update.guid = update.guid || new ObjectId();
  update.collection = this._name;
  if (store === '_local') {
    this._updates.push(update);
  } else {
    this._updates = this._updates.filter(function (u) { return !ObjectId.equal(u.guid, update.guid); });
  }
  applyUpdate(this[store], update);
  if (store === '_local') {
    this._updates.push(update);
    this._addedUpdate(update);
  } else {
    this._local = clone(this._remote);
    for (var i = 0; i < this._updates.length; i++) {
      applyUpdate(this['_local'], this._updates[i]);
    }
  }
  this._emitUpdate();
};
ClientCollection.prototype.insert = function (item) {
  item._id = item._id || new ObjectId();
  this.writeUpdate({
    action: 'insert',
    item: clone(item)
  }, '_local');
};
ClientCollection.prototype.update = function (_id, update) {
  if (typeof _id === 'string' || ObjectId.isObjectId(_id)) {
    this.writeUpdate({
      action: 'update',
      itemId: _id,
      update: clone(update)
    }, '_local');
  } else {
    var items = this.find(_id);
    for (var i = 0; i < items.length; i++) {
      this.writeUpdate({
        action: 'update',
        itemId: items[i]._id,
        update: clone(update)
      }, '_local');
    }
  }
};
ClientCollection.prototype.remove = function (_id) {
  if (typeof _id === 'string' || ObjectId.isObjectId(_id)) {
    this.writeUpdate({
      action: 'remove',
      itemId: _id
    }, '_local');
  } else {
    var items = this.find(_id);
    for (var i = 0; i < items.length; i++) {
      this.writeUpdate({
        action: 'remove',
        itemId: items[i]._id
      }, '_local');
    }
  }
};
