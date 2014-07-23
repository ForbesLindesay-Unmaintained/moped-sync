'use strict';

var machine = Math.floor(Math.random() * (16777216));
var pid = Math.floor(Math.random() * (32767));
var increment = 0;

module.exports = ObjectId;
function ObjectId() {
  var timestamp = Math.floor(new Date().valueOf() / 1000);
  this.$oid = toString(timestamp.toString(16), machine.toString(16), pid.toString(16), (increment++).toString(16))
}

var isObjectId = ObjectId.isObjectId = function (obj) {
  return obj && typeof obj === 'object' && typeof obj.$oid === 'string' && obj.$oid.length === 24;
};

ObjectId.equal = function (left, right) {
  if (typeof left === 'string' && typeof right === 'string') return left === right;
  if (isObjectId(left) && isObjectId(right)) {
    return left.$oid === right.$oid;
  }
  if ((typeof left === 'string' || isObjectId(left)) && (typeof right === 'string' || isObjectId(right))) {
    return false;
  }
  throw new TypeError('ObjectIds must be either objects of the form `{$obj: "string"}` or strings.');
};

function toString(timestamp, machine, pid, increment) {
    return '00000000'.substr(0, 8 - timestamp.length) + timestamp +
           '000000'.substr(0, 6 - machine.length) + machine +
           '0000'.substr(0, 4 - pid.length) + pid +
           '000000'.substr(0, 6 - increment.length) + increment;
};

