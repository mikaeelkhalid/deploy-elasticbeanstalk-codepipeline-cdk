var express = require('express');
var app = express();
var fs = require('fs');
var port = 4000;

app.get('/test', function (req, res) {
    res.send('the REST endpoint test run!');
});

app.get('/', function (req, res) {
    html = fs.readFileSync('index.html');
    res.writeHead(200);
    res.write(html);
    res.end();
});

app.listen(port, function () {
    console.log('Server running at http://127.0.0.1:%s', port);
});
