"use strict";

var http  = require('http');
var os    = require("os");
var spawn = require('child_process').spawn;

var LENK_VERSION = '0.0.0.0.0.0.1.unstable';

var LISTENER_HOST = 'lgmd-jlesko-3.corp.netflix.com';
var LISTENER_PORT = 80;

var task = { id: '', time: 0 };
var inLoop = false;


main();


function main () {
    
    start('RUN_TASK');
    
    var cmd = spawn(process.argv[2], process.argv.splice(3));
    cmd.stdout.on('data', function (data) {
        
      data = String(data);    
      
      // pass through stdout  
      process.stdout.write(data);
        
      // Shakti Startup
      if (data.match(/Running Shakti|Starting Shakti|restarting due to changes/i)) {
          start('STARTUP');
          inLoop = true;
      }
      else if (data.match(/shakti up/i)) {
          stop('STARTUP');
      }
      else if (inLoop) {
          if (data.match(/Starting.*?watch:less/i)) {
              start('RELOAD_LESS');
          }
          else if (data.match(/Starting.*?watch:jsx/i)) {
              start('RELOAD_JSX');
          }
          else if (data.match(/error compiling jsx/i)) {
              sendEvent('JSX_ERROR', {});
              echo('LENK SEND ==> JSX_ERROR');
              clear('RELOAD_JSX');
          }
          else if (data.match(/Finished installing assets/i)) {
              stop('RELOAD_LESS');
              stop('RELOAD_JSX');
          }
      }
      
    });

    cmd.on('close', function (code) {
        stop('RUN_TASK');
    });
    
    cmd.stderr.on('data', function (data) {
        // ...
    });
}


//// Task Control


function start (taskId) {
    if (taskId === task.id) { return; }
    task.id = taskId;
    task.time = timestamp();
    echo('LENK START ==> ' + task.id);
}

function stop (taskId) {
    if (taskId !== task.id) { return; }
    var duration = timestamp() - task.time;
    sendEvent(taskId, { duration: duration });
    clear(taskId);
    echo('LENK SEND ==> ' + taskId + ' - ' + duration + ' ms');
}

function clear (taskId) {
    if (taskId !== task.id) { return; }
    task.id = '';
    task.time = 0;
}


//// Events


function sendEvent (eventName, postData) {

    postData.event = eventName;
    postData.time = timestamp();
    postData.hostname = os.hostname();
    postData.command = process.argv.join(' ');
    postData.version = LENK_VERSION;

    var sData = JSON.stringify(postData);
    
    var postOptions = {
        host: LISTENER_HOST,
        port: LISTENER_PORT,
        path: '/add',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(sData)
        }
    };

    var postReq = http.request(postOptions, function(res) {});
    
    postReq.write(sData);
    postReq.end();
}


//// Utils


function timestamp () {
    return (new Date).getTime();
}

// remove color codes
function clean (raw) {
    return raw.replace(/\u001b\[\d+m/g, '');
}

function echo (msg) {
    msg = '  ' + msg + '  ';
    var line = '-'.repeat(msg.length);
    console.log([line, msg, line].join('\n'));
}


