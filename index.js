// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var md5 = require('md5');
var xssFilters = require('xss-filters');
var sqlite = require('sqlite3');

var port = 2333;
var db = new sqlite.Database('db.db');

function checkUserValid(socket){
  if (!socket.username || !socket.avatar) {
    socket.emit('login error', 'Please input your information again.');
    return false
  }
  return true
}


server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom

var numUsers = 0;

io.on('connection', function (socket) {
  var addedUser = false;

  if (addedUser) checkUserValid(socket);

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    if (!checkUserValid(socket)) return false;
    if (data.length > 140) return socket.emit('msg error', 'The length of your message is too ♂ long!');

    // we tell the client to execute 'new message'
    io.emit('new message', {
      username: xssFilters.inHTMLData(socket.username),
      avatar: xssFilters.inDoubleQuotedAttr(socket.avatar),
      message: xssFilters.inHTMLData(data)
    });

    let ip, time;

    ip =  socket.handshake.headers["x-real-ip"] || socket.request.connection.remoteAddress;
    time = Date.now() / 1000 | 0;

    db.run('INSERT INTO history (username, avatar, message, time, ip) VALUES (?, ?, ?, ?, ?)',
            [socket.username, socket.avatar, data, time, ip]);
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (data) {
    if (addedUser) return socket.emit('allow enter');

    if(!data.username) return socket.emit('login error', 'Input your username!');
    if(!data.email) return socket.emit('login error', 'Input your email address!');
    if(data.username.length > 14) return socket.emit('login error', 'The length of your name is too ♂ long!');
    if(data.email.length > 50) return socket.emit('login error', 'The length of your email address is too ♂ long!');

    // we store the username in the socket session for this client
    socket.username = data.username;
    socket.avatar = md5(data.email);
    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      avatar: socket.avatar,
      numUsers: numUsers
    });

    socket.emit('allow enter');
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username,
      avatar: socket.avatar
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  socket.on('recent message', (data) => {
    db.all('SELECT username, avatar, message, time FROM history ORDER BY time ASC LIMIT 50', (err, rows) => {
      let rowCount = 0;

      rows.map((row) => {
        socket.emit('new message', {
            username: xssFilters.inHTMLData(row.username),
            avatar: xssFilters.inDoubleQuotedAttr(row.avatar),
            message: xssFilters.inHTMLData(row.message),
            initMsg: true
        });

        rowCount ++;

        if(rows.length >= rowCount) socket.emit('init done');

        return false;
      });
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
