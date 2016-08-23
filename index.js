'use strict';

const io = require('socket.io')(8081);
const fs = require('fs');
const vksdk = require('vksdk');
const request = require('request');
const vk = new vksdk({
  'appId': 0,
  'appSecret': '',
  'language': 'ru'
});

let queue = [];
let isFree = true;
let activeObj = {};
let finished = [];
let timeStardet = null;

io.on('connection', initSocket);

let VK = {};

vk.on('serverTokenReady', function(_o) {
  vk.setToken(_o.access_token);
});

// https://oauth.vk.com/authorize?client_id=5598725&response_type=token&scope=8196
// 21:36 expires
vk.setToken('');

vk.setSecureRequests(true);

// ====

getUploadServer()
  .then(function(url) {
    vk.server_url = url;
    console.log('VK Server is ready');
  })
  .catch(function(err) {
    console.log(err);
  });

function runTimer() {
  setInterval(function() {
    if (isFree && queue.length > 0) {
      isFree = false;
      activeObj = queue.splice(0, 1)[0];
      console.log('Run new task id: ' + activeObj.id);
      uploadData(activeObj.bin, vk.server_url);
    }
  }, 3000);
}

function getUploadServer() {
  return new Promise(function(res, rej) {
    vk.request("photos.getUploadServer", {"test_mode": 1, "album_id": 234823009, "group_id": 75937874}, function (data) {
      if (data.response) {
        res(data.response.upload_url);
      }
      else {
        rej(data);
      }
    });
  });
}

function uploadData(data, url) {
  console.log('Request new data', activeObj.id);

  var binData = new Buffer(data.split(",")[1], 'base64');

  var formData = {
    file1: {
      value: binData,
      options: {
        filename: 'image.png',
        contentType: 'image/png'
      }
    }
  };

  request.post({
    url: url,
    formData: formData
  }, function(err, httpResponse, body) {
    if (!err) {
      var result = JSON.parse(body);

      console.log('saving...', activeObj.id);

      vk.request('photos.save', {
        album_id: result.aid,
        group_id: result.gid,
        hash: result.hash,
        photos_list: result.photos_list,
        server: result.server
      }, function(data) {
        activeObj.url = 'https://vk.com/album-75937874_' + data.response[0].id;
        activeObj.photoId = data.response[0].id;
        delete activeObj.bin;

        finished.push(activeObj);

        console.log('finish id:', activeObj.id);

        fs.writeFileSync('data.json', JSON.stringify(finished));

        console.log('writing in data.json');
        console.log('finished.length = ' + finished.length);

        let speed = (Date.now() - timeStardet)/1000/finished.length;
        console.log('speed:', speed);
        console.log('time to finish:', speed * (721 - finished.length));
        console.log('date finish:', new Date(Date.now() + speed * (721 - finished.length) * 1000));

        isFree = true;

        console.log('is free');
      });
    } else {
      console.log(err);
    }
  });
}

function strToArrayBuffer(str) {
  var buf = new ArrayBuffer(str.length * 2);
  var bufView = new Uint16Array(buf);
  for (var i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

function initSocket(socket) {
  socket.on('img', function (data) {
    if (timeStardet == null) {
      timeStardet = Date.now();
    }
    queue.push(data);
    console.log('Add to queue', data.id, ' queue.length =', queue.length);
  });
}

runTimer();
