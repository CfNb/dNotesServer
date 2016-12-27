var express = require('express');
var app = express();

app.use('', function (req, res) {
	console.log("OK");
	res.send("OK");
})

app.listen(8080, function () {
  console.log('printflowmonitor app listening on port 8080!')
})