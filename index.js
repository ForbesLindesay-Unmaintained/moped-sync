'use strict';

var assert = require('assert');
var clone = require('clone');
var match = require('mongomatch');
var ObjectId = require('moped-id');
var applyUpdate = require('moped-apply-update');
var asap = require('asap');

module.exports = Client;
function Client(collections, initial) {
  initial = clone(initial);
  var state = initial && initial.action === 'initialize' ? initial.state : {};
  for (var i = 0; i < collections.length; i++) {
    this[collections[i]] = new ClientCollection(collections[i], state[collections[i]] || [], this._emitChange.bind(this), this._addLocalChange.bind(this));
  }
  this.next = initial && initial.action === 'initialize' ? initial.next : null;
  this._updateHandlers = [];
  this._pendingChanges = [];
  this._localChangeHandlers = [];
}
Client.prototype._addLocalChange = function (update) {
  this._pendingChanges.push(update);
  for (var i = 0; i < this._localChangeHandlers.length; i++) {
    asap(this._localChangeHandlers[i]);
  }
};
Client.prototype._emitChange = function () {
  var firstError;
  for (var i = 0; i < this._updateHandlers.length; i++) {
    try {
      this._changeHandlers[i]();
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
Client.prototype.onChange = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._changeHandlers.push(fn);
};
Client.prototype.onLocalChange = function (fn) {
  assert(typeof fn === 'function', 'fn should be a function but was ' + typeof fn);
  this._localChangeHandlers.push(fn);
};
Client.prototype.writeChanges = function (changes) {
  if (changes.next !== undefined) {
    this.next = changes.next;
  }
  changes.changes.forEach(function (change) {
    if (change.collection  in this) {
      this[change.collection].writeUpdate(change, '_remote');
    }
  }.bind(this));
};

Client.prototype.getLocalChanges = function () {
  return clone(this._pendingChanges);
};
Client.prototype.setLocalChangesHandled = function (n) {
  if (this._pendingChanges.length < n) {
    throw new Error('No changes are pending');
  }
  this._pendingChanges.splice(0, n);
};

function ClientCollection(name, data, emitChange, addChange) {
  this._name = name;
  this._emitChange = emitChange;
  this._addChange = addChange;
  this._remote = data;
  this._local = clone(data);
  this._updates = [];
}
ClientCollection.prototype.find = function (query) {
  if (!query) return clone(this._local);
  return clone(this._local.filter(match.bind(null, query)));
};
ClientCollection.prototype.writeUpdate = function (update, store) {
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
    this._addChange(update);
  } else {
    this._local = clone(this._remote);
    for (var i = 0; i < this._updates.length; i++) {
      applyUpdate(this['_local'], this._updates[i]);
    }
  }
  this._emitChange();
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
