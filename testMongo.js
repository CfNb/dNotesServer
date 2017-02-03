/*jslint node: true, vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */

var MongoClient = require('mongodb').MongoClient, assert = require('assert');

// Connection URL
//The myproject indicates the database to use. If the database is omitted, the MongoClient uses the default test database
var url = 'mongodb://localhost:27017/myproject';
// Use connect method to connect to the server
MongoClient.connect(url, function (err, db) {
	assert.equal(null, err);
	console.log("connected sucessfully to server");
    /*
    insertDocuments(db, function () {
        db.close();        
    });
    */
    /*
    findAllDocuments(db, function () {
        db.close();
    });
    */
    /*
    findDocuments(db, function () {
        db.close();
    });
    */
    /*
    updateDocument(db, function () {
        db.close();
    });
    */
    /*
    removeDocument(db, function () {
        db.close();
    });
    */
    
    indexCollection(db, function () {
        db.close();
    });

});

var insertDocuments = function (db, callback) {
  // Get the documents collection
    var collection = db.collection('documents');
  // Insert some documents
    collection.insertMany([
        {a : 5, b : 6}, {a : 7}, {a : 9}
    ], function (err, result) {
        assert.equal(err, null);
        assert.equal(3, result.result.n);
        assert.equal(3, result.ops.length);
        console.log("Inserted 3 documents into the collection");
        callback(result);
    });
};

//query to find all items in documents
var findAllDocuments = function (db, callback) {
  // Get the documents collection
    var collection = db.collection('documents');
  // Find some documents
    collection.find({}).toArray(function (err, docs) {
        assert.equal(err, null);
        console.log("Found the following records");
        console.log(docs);
        callback(docs);
    });
};

// query filter
var findDocuments = function (db, callback) {
  // Get the documents collection
    var collection = db.collection('documents');
  // Find some documents
    collection.find({'a': 3}).toArray(function (err, docs) {
        assert.equal(err, null);
        console.log("Found the following records");
        console.log(docs);
        callback(docs);
    });
};

//update a document in documents collection
var updateDocument = function (db, callback) {
  // Get the documents collection
    var collection = db.collection('documents');
  // Update document where a is 2, set b equal to 1
    collection.updateOne({ a : 2 }, { $set: { b : 1 } }, function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        console.log("Updated the document with the field a equal to 2");
        callback(result);
    });
};

//remove a document from the collection
var removeDocument = function (db, callback) {
  // Get the documents collection
    var collection = db.collection('documents');
  // Insert some documents
    collection.deleteOne({ a : 3 }, function (err, result) {
        assert.equal(err, null);
        assert.equal(1, result.result.n);
        console.log("Removed the document with the field a equal to 3");
        callback(result);
    });
};

//index a field in the collection, can improve performance
var indexCollection = function (db, callback) {
    db.collection('documents').createIndex(
        { "a": 1 },
        null,
        function (err, results) {
            console.log(results);
            callback();
        }
    );
};
