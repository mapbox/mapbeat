var app = require('express')();
var bodyParser = require('body-parser');
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
  res.sendfile('index.html');
});

app.post('/', function (req, res) {
    console.log(req.body);
    io.emit('data', req.body);
    res.send('done');
});

io.on('connection', function (socket) {
  console.log('a user connected');
  socket.on('disconnect', function () {
      console.log('a user disconnected');
  });
});

http.listen(80, function () {
  console.log('listening on *:80');
});