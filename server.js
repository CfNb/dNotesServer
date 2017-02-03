/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */

var fs = require('fs'); // node filesystem
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var express = require('express');
var app = express();
var url = 'mongodb://localhost:27017/myproject';

///////////////////////////////////////////
// MongoDB Functions
function insertNote(db, newNote, callback) {
    'use strict';
    var collection = db.collection('notes');
    collection.insertOne(newNote, function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        assert.equal(1, result.ops.length);
        console.log("Inserted 1 document into notes");
        callback(result);
    });
}

function getNotes(db, theQuery, callback) {
    'use strict';
    var collection = db.collection('notes');
  // Find some notes
    collection.find(theQuery).toArray(function (err, docs) {
        assert.equal(err, null);
        console.log("Found the following records");
        console.log(docs);
        callback(docs);
    });
}


///////////////////////////////////////////
// Express Handlers
// if node is running along side apache server,
// ProxyPass must be set up for each url in apache httpd.conf file

/* note info:
customer: customer #
job: job #, undefined for Customer Notes
item: item #, undefined for Job Notes
author: initials, stored in localstorage and userID var
stage: job stage determined by file URL; GTG, Preflight, Proof #1, Job, etc.
date: current date object, when note was created
content: user entered text
deleted: bool, has the note been removed, default false
*/

// receives new note info, saves to db
app.use('/notesend', function (req, res) {
    'use strict';
    // user sent new note date via get req

        // Customer, Job, or item db entry if needed?
    
    // format data for new db document
    var newNote = {
        customer : req.query.customer,
        job : req.query.job,
        item : req.query.item,
        author : req.query.author,
        stage : req.query.stage,
        date : req.query.date,
        content : req.query.content,
        deleted: false
    };
    
    // format query for response
    var theQuery = {
        customer : req.query.customer,
        job : req.query.job,
        item : req.query.item,
        deleted: false
    };
    
    // save note to db
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        console.log("connected sucessfully to db server");
        // save note to db
        insertNote(db, newNote, function (results) {
            // query db
            getNotes(db, theQuery, function (docs) {
                db.close();
                res.send(docs);
            });
        });
    });

    // send back refreshed list of all notes for that category(Customer, Job or Item)

        
        
        
    // format and send response(JSON array of notes?)
    
    
    
    // on error
    //res.send('error');
    
    
});




// receives note identifiers, returns matching notes
app.use('/noteget', function (req, res) {
    'use strict';
    // format query for response
    var theQuery = {
        customer : req.query.customer,
        job : req.query.job,
        item : req.query.item,
        deleted: false
    };
    
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        console.log("connected sucessfully to db server");
        // get notes from db
        getNotes(db, theQuery, function (docs) {
            db.close();
            res.send(docs);
        });
    });
});




app.use('/printflowstatus', function (req, res) {
    'use strict';
	// readdir returns array of contents of folder
	// stat returns info object about target
	fs.stat('/Users/dbadmin/Test', function (err, stats) {
		if (err) {
			res.send(err);
		} else {
			res.send(stats.ctime + ' reply from server');
		}
	});
	// connect to remote printflow server

	// get modified date of printflow folder

	// return date
	
});

// '/' must be last, or it will supercede other urls(ex. '/test' wont fire after '/')
app.use('/', function (req, res) {
    'use strict';
	res.send('server received the text \' ' + req.query.text
             + '\' from ip ' + req.ip);
});

app.listen(8080, function () {
    'use strict';
    console.log('node service app listening on port 8080!');
});