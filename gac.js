//Sends a CLOSE message to the GarageMote after 9PM (21:00 hours) and before 5AM (05:00 hours), and only when the door has been in OPEN status more than 15 minutes.
//For safety, it sends UP TO 3x messages between this time frame - in case the GarageMote sensors are not aligned well or malfunction (causing OPEN, CLOSING.., OPEN alternations).
// An entry will be created in the NeDB with an _id of GAC_ and the node id of the garage mote that controlls the door.

// Please choose the following values carefully.
// leaveOpenTimeout needs to be set long enough so that the door isn't closing as a car is driven in or out of the garage or while it is warming up.
// garageIdPrefix needs to contain at least one nonumeric character so that the entry is not picked up and displayed in the web interface.
var pollInterval = 300000; // This is in milliseconds 5min * 60 seconds * 1000.  How often the polling happens.
var startTime = 21; // This is the evening hour in military time to begin looking for an open garage door.
var endTime = 5; // This is the morning hour in military time to stop looking for an open garage door.
var leaveOpenTimeout = 15; //  This is the time in minutes the garage door should be left open before it is closed.
var maxCloseCount = 3; // The max number of times the garage should be closed in a given evening before the door is left open.
var garageIdPrefix = 'GAC_';

function toStandardTime(militaryTime) {
  militaryTime = militaryTime.split(':');
  if (militaryTime[0] > 12) {
    return (militaryTime[0] - 12) + ':' + militaryTime[1] + 'PM';
  } else {
    return militaryTime.join(':') + 'AM';
  }
}

exports.events = {
  garageAutoClose: {
    label:'Garage : Auto-CLOSE between [' + toStandardTime(startTime + ':00') + ',' + toStandardTime(endTime + ':00') + ']',
    icon:'comment',
    descr:'Auto Close Garage after 9PM',
    nextSchedule:function(nodeAtScheduleTime) { return pollInterval },
    scheduledExecute:function(nodeAtScheduleTime) { db.findOne({ _id : garageIdPrefix + nodeAtScheduleTime._id }, function (err, gacInfo) {

var nowDate = new Date(Date.now());
var nodeUpdated = false;

// If the GAC entity was not found, create a new one.
if (gacInfo == null) {
  gacInfo = {
        _id: garageIdPrefix + nodeAtScheduleTime._id,
        status: nodeAtScheduleTime.metrics['Status'].value,
        openDate: null,
        closeCount: 0
        };
  db.insert(gacInfo);

  console.log('New GAC entry added: ' + gacInfo._id);
};

if (gacInfo.status != nodeAtScheduleTime.metrics['Status'].value) {
  gacInfo.status =  nodeAtScheduleTime.metrics['Status'].value
  nodeUpdated = true;
};

  /*just emit a log the status to client(s) */
  console.log('Garage Auto close Status Node Id: ' + gacInfo._id + " Status: " + gacInfo.status);

  if (gacInfo.status && gacInfo.status == 'OPEN') {

    console.log('Initial gacInfo.openDate ' + gacInfo.openDate);
    console.log('Initial gacInfo.closeCount ' + gacInfo.closeCount);

    /* Only automatically close between 9pm and 5am and closeCount < maxCloseCount */
    if ((nowDate.getHours() >= startTime || nowDate.getHours() <= endTime) &&
        (gacInfo.closeCount < maxCloseCount)) {

      if (gacInfo.openDate == null) {
        gacInfo.openDate = nowDate;
        nodeUpdated = true;
      };

      /* Elapsed time in minutes the garage door has been open */
      var elapsedTimeMinutes = Math.round(((nowDate - gacInfo.openDate)) / (60*1000));
      console.log('GARAGE SHOULD BE CLOSED ' + elapsedTimeMinutes);

      /* Close the door if open more than 15 minutes */
      if (elapsedTimeMinutes >= leaveOpenTimeout) {
        sendMessageToNode({nodeId:nodeAtScheduleTime._id, action:'CLS'});
        gacInfo.closeCount++;
        gacInfo.openDate = null;
        nodeUpdated = true;
      };

      console.log('Close Count: ' + gacInfo.closeCount);
    };
  };

  // Reset the openDate to null when the hours are between 7am and 8pm
  if (nowDate.getHours() < startTime - 1 && nowDate.getHours() > endTime + 1 && gacInfo.openDate) {
    gacInfo.openDate = null;
    nodeUpdated = true;
  };

  // Reset the close count
  if (nowDate.getHours() < startTime - 1 && nowDate.getHours() > endTime && gacInfo.closeCount > 0) {
    gacInfo.closeCount = 0;
    nodeUpdated = true;
  };

  if (nodeUpdated) {
    db.update({ _id: gacInfo._id }, { $set : gacInfo}, {}, function (err, numReplaced) { console.log('gp:   ['+gacInfo._id+'] DB-Updates:' + numReplaced);});
  };
});
 } }
};
