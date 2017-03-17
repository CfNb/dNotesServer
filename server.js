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

// database Connection URL
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
        console.log(Date() + " Found " + docs.length + " records");
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
            console.log(Date() + " Set deleted of note " + noteID + " to true");
            callback(doc);
        }
    );
}

///////////////////////////////////////////
// Node FS functions

//reads .digital_info.xml file
function jsFromXML(url, callback) {
    'use strict';
    console.log(Date() + ' Given url:' + url);
    
    fs.readFile(url, 'utf8', function (err, data) {
        if (!err) {
            //console.log(JSON.stringify(data));
            console.log(Date() + ' readfile ok');
            parseString(data, callback);
        } else {
            console.log(Date() + ' Passing error to callback');
            callback(err, data);
        }
    });
}

var dbGetNotes = function (newNote, theQuery, res) {
    'use strict';
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        
        if (newNote === '') {
            // get notes from db
            console.log(Date() + ' Connected sucessfully to db server - noteget');
            console.log(theQuery);
            getNotes(db, theQuery, function (docs) {
                db.close();
                res.send(docs);
            });
        } else {
            // save note to db, returning refreshed note list
            console.log(Date() + " Connected sucessfully to db server - notesend");
            console.log(theQuery);
            insertNote(db, newNote, function (results) {
                getNotes(db, theQuery, function (docs) {
                    db.close();
                    res.send(docs);
                });
            });
        }
    });
};

function confirmDir(customerNumber, jobNumber, itemNumber, url, fileName, newNote, res, callback, last) {
    'use strict';
    fs.stat(url + '/' + fileName, function (err, stats) {
        console.log(Date() + ' confirmDir-' + stats.isDirectory());
        var theQuery;
        if (stats.isDirectory()) {
            var gtgNum = fileName.split(" - ").pop();
            console.log(Date() + ' confirmDir-GtG: ' + fileName.split(" - ").pop());
            
            theQuery = {
                customer : customerNumber,
                job : { $in: [ jobNumber, gtgNum ] },
                item : itemNumber,
                deleted: false
            };
            callback(newNote, theQuery, res);
        } else if (last) {
            console.log(Date() + ' confirmDir-' + err);
            theQuery = {
                customer : customerNumber,
                job : jobNumber,
                item : itemNumber,
                deleted: false
            };
            callback(newNote, theQuery, res);
        }
    });
}

function setJobQuery(customerNumber, jobNumber, itemNumber, url, newNote, res, callback) {
    'use strict';
    var jobQuery;
    //check for GtG if requesting job notes
    if (jobNumber !== undefined && itemNumber === undefined && !jobNumber.startsWith("G")) {
        console.log(Date() + ' setJobQuery- Job notes and is not GtG Job');
        url =  url + '/Indigo - Job ' + jobNumber;
        console.log(Date() + ' setJobQuery-' + url);
        fs.readdir(url, function (err, files) {
            console.log(Date() + ' setJobQuery-readdir');
            if (!err) {
                console.log(Date() + ' setJobQuery-' + files);
                console.log(files.length);
                var i, fileName, theQuery;
                var jobQueries = [];
                var fileCount = files.length;
                for (i = 0; i < fileCount; i++) {
                    console.log(Date() + ' setJobQuery-' + files[i]);
                    fileName = files[i];
                    if (fileName.startsWith("GtG - ")) {
                        console.log('found GtG');
                        jobQueries.push(fileName.split(" - ").pop());
                    }
                }
                if (jobQueries.length > 0) {
                    console.log(Date() + ' setJobQuery-found GtG');
                    jobQueries.push(jobNumber);
                    theQuery = {
                        customer : customerNumber,
                        job : { $in: jobQueries },
                        item : itemNumber,
                        deleted: false
                    };
                    callback(newNote, theQuery, res);
                } else {
                    console.log(Date() + ' setJobQuery-No GtGs found');

                    theQuery = {
                        customer : customerNumber,
                        job : jobNumber,
                        item : itemNumber,
                        deleted: false
                    };
                    callback(newNote, theQuery, res);
                }
            } else {
                console.log(Date() + ' setJobQuery-' + err);
                res.send('error - customer undefined');
            }
        });
    } else {
        
        console.log(Date() + ' setJobQuery-Not job notes or is GtG Job');
        
        var theQuery = {
            customer : customerNumber,
            job : jobNumber,
            item : itemNumber,
            deleted: false
        };
        callback(newNote, theQuery, res);
    }
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

// receives new note info in post format, saves to db, returns notes
app.use('/notesend', function (req, res) {
    'use strict';
    console.log(Date() + ' notesend requested');
    // user sent new note date via post
    
    //gets customer# from given url by reading .xml file
    jsFromXML(req.body.url + '/.digital_info.xml', function (err, result) {
        if (!err) {
            var customerNumber = result.Main.Customer[0];
            var jobNumber = req.body.job;
            var itemNumber = req.body.item;

            // format data for new db document
            var newNote = {
                customer : customerNumber,
                job : jobNumber,
                item : itemNumber,
                author : req.body.author,
                filename : req.body.filename,
                date : req.body.date,
                content : req.body.content,
                deleted: false
            };
            
            setJobQuery(customerNumber, jobNumber, itemNumber, req.body.url, newNote, res, dbGetNotes);
        } else {
            console.log(Date() + ' xml error:' + err);
            res.send('error - customer undefined');
        }
    });
});

// receives note identifiers, returns matching notes
app.use('/noteget', function (req, res) {
    'use strict';
    console.log(Date() + ' noteget requested');
    
    //gets customer# from given url by reading .xml file
    jsFromXML(req.body.url + '/.digital_info.xml', function (err, result) {
        if (!err) {
            var customerNumber = result.Main.Customer[0];
            var jobNumber = req.body.job;
            var itemNumber = req.body.item;
            var newNote = '';

            setJobQuery(customerNumber, jobNumber, itemNumber, req.body.url, newNote, res, dbGetNotes);
        } else {
            console.log(Date() + ' xml error:' + err);
            res.send('error - customer undefined');
        }
    });
});

// receives note id, deletes note, returns refreshed notes list
app.use('/notedelete', function (req, res) {
    'use strict';
    console.log(Date() + ' notedelete requested');
    var noteID = req.query.id;
    
    MongoClient.connect(url, function (err, db) {
        assert.equal(null, err);
        console.log(Date() + ' Connected sucessfully to db server - notdelete');
        // flag note as deleted in db, returning refreshed note list
        deleteNote(db, noteID, function (doc) {
            // query db
            getNotes(db, doc.value, function (docs) {
                db.close();
                res.send(docs);
            });
        });
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
    console.log(Date() + ' nodeservice app listening on port 8080!');
});