/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */

var fs = require('fs'); // node filesystem
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var ObjectId = require('mongodb').ObjectId;
var express = require('express');
var app = express();
var bodyParser = require('body-parser');
var parseString = require('xml2js').parseString;

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
        console.log("Found " + docs.length + " records");
        console.log(docs);
        callback(docs);
    });
}

function deleteNote(db, noteID, callback) {
    'use strict';
    var collection = db.collection('notes');
    //flag note as deleted
    collection.findOneAndUpdate(
        {_id: new ObjectId(noteID)},
        {$set: {deleted: true}},
        {projection: {"_id" : 0,  "customer" : 1, "job" : 1, "item" : 1, "deleted" : 1}},
        function (err, doc) {
            assert.equal(err, null);
            console.log("Flagged note " + noteID + " deleted");
            callback(doc);
        }
    );
}

///////////////////////////////////////////
// Node FS functions
function jsFromXML(url, callback) {
    'use strict';
    console.log('given url:' + url);
    
    fs.readFile(url, 'utf8', function (err, data) {
        if (!err) {
            console.log(JSON.stringify(data));
            console.log('readfile ok');
            parseString(data, callback);
        } else {
            console.log('pass error to callback');
            callback(err, data);
        }
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

// receives new note info in post format, saves to db
app.use('/notesend', function (req, res) {
    'use strict';
    console.log('notesend requested');
    // user sent new note date via get req
    
    //get customer# from given url by reading .xml file
    var customerNumber;
    
    jsFromXML(req.body.url + '/.digital_info.xml', function (err, result) {
        if (!err) {
            customerNumber = result.Main.Customer[0];
        } else {
            console.log(err);
        }
    });
    
    if (customerNumber === undefined) {
        res.send('error - customer undefined');
    } else {
        // format data for new db document
        var newNote = {
            customer : customerNumber,
            customerName : req.body.customer,
            job : req.body.job,
            item : req.body.item,
            author : req.body.author,
            filename : req.body.filename,
            date : req.body.date,
            content : req.body.content,
            deleted: false
        };

        // format query for response
        var theQuery = {
            customer : req.body.customer,
            job : req.body.job,
            item : req.body.item,
            deleted: false
        };

        // save note to db
        MongoClient.connect(url, function (err, db) {
            assert.equal(null, err);
            console.log("connected sucessfully to db server");
            // save note to db, returning refreshed note list
            insertNote(db, newNote, function (results) {
                // query db
                getNotes(db, theQuery, function (docs) {
                    db.close();
                    res.send(docs);
                });
            });
        });
    }
});

// receives note identifiers, returns matching notes
app.use('/noteget', function (req, res) {
    'use strict';
    console.log('noteget requested');
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

// receives note id, deletes note, returns refreshed notes list
app.use('/notedelete', function (req, res) {
    'use strict';
    console.log('notedelete requested');
    var noteID = req.query.id;
    
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        console.log("connected sucessfully to db server");
        // flag note as deleted in db, returning refreshed note list
        deleteNote(db, noteID, function (doc) {
            console.log(doc.value);
            // query db
            getNotes(db, doc.value, function (docs) {
                db.close();
                res.send(docs);
            });
        });
    });
});

//'/printflowstatus' is unused, can use for testing purposes
app.use('/printflowstatus', function (req, res) {
    'use strict';
    jsFromXML(req.query.url, function (err, result) {
        if (!err) {
            res.send(result.Main.Customer[0]);
        } else {
            console.log(err);
            res.send(err);
        }
    });
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