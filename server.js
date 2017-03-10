/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */

var fs = require('fs'); // node filesystem
var MongoClient = require('mongodb').MongoClient, assert = require('assert');
var ObjectId = require('mongodb').ObjectId;
var express = require('express');
var parseString = require('xml2js').parseString;
var bodyParser = require('body-parser');

var app = express();

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));

// parse application/json
app.use(bodyParser.json());

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
        console.log(Date() + " Inserted 1 document into notes");
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
        console.log(Date() + ' ' + docs);
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
            console.log(Date() + " Flagged note " + noteID + " deleted");
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
            console.log(Date() + ' readfile ok');
            parseString(data, callback);
        } else {
            console.log(Date() + ' pass error to callback');
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
filename: name of file at time of note, filename should reveal job stage
date: current date object, when note was created
content: user entered text
deleted: bool, has the note been removed, default false
*/

// receives new note info in post format, saves to db
app.use('/notesend', function (req, res) {
    'use strict';
    console.log(Date() + ' notesend requested');
    // user sent new note date via post
    
    //get customer# from given url by reading .xml file
    var customerNumber;
    
    jsFromXML(req.body.url + '/.digital_info.xml', function (err, result) {
        if (!err) {
            customerNumber = result.Main.Customer[0];

            // format data for new db document
            var newNote = {
                customer : customerNumber,
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
                customer : customerNumber,
                job : req.body.job,
                item : req.body.item,
                deleted: false
            };

            // save note to db
            MongoClient.connect(url, function (err, db) {
                assert.equal(null, err);
                console.log(Date() + " connected sucessfully to db server - notesend");
                // save note to db, returning refreshed note list
                insertNote(db, newNote, function (results) {
                    // query db
                    getNotes(db, theQuery, function (docs) {
                        db.close();
                        res.send(docs);
                    });
                });
            });
        } else {
            console.log(Date() + ' ' + err);
            res.send('error - customer undefined');
        }
    });
});

// receives note identifiers, returns matching notes
app.use('/noteget', function (req, res) {
    'use strict';
    console.log(Date() + 'noteget requested');
    
    //get customer# from given url by reading .xml file
    var customerNumber;
    
    jsFromXML(req.body.url + '/.digital_info.xml', function (err, result) {
        if (!err) {
            customerNumber = result.Main.Customer[0];
            
            // format query for response
            var theQuery = {
                customer : customerNumber,
                job : req.body.job,
                item : req.body.item,
                deleted: false
            };

            MongoClient.connect(url, function (err, db) {
                assert.equal(null, err);
                console.log(Date() + " connected sucessfully to db server - notget");
                // get notes from db
                getNotes(db, theQuery, function (docs) {
                    db.close();
                    res.send(docs);
                });
            });
        } else {
            console.log(Date() + ' ' + err);
            res.send('error - customer undefined');
        }
    });
});

// receives note id, deletes note, returns refreshed notes list
app.use('/notedelete', function (req, res) {
    'use strict';
    console.log(Date() + 'notedelete requested');
    var noteID = req.query.id;
    
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        console.log(Date() + " connected sucessfully to db server - notdelete");
        // flag note as deleted in db, returning refreshed note list
        deleteNote(db, noteID, function (doc) {
            console.log(Date() + ' ' + doc.value);
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
            console.log(Date() + err);
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
    console.log(Date() + ' node service app listening on port 8080!');
});