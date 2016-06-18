var app = require('express')();
var bodyParser = require('body-parser');
var https = require('https').Server(app);
var io = require('socket.io')(https);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});

app.post('/', function (req, res) {
    console.log('got data');
    io.emit('data', req.body);
    res.send('done');
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('disconnect', function () {
      console.log('a user disconnected');
  });
});

https.listen(80, function () {
  console.log('listening on *:80');
});