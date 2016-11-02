var express = require("express");
var mongo = require('mongodb').MongoClient;
var path = require("path");
var shortHash = require("shorthash");
var isUrl = require("is-url");

var app = express();

//LOCAL --> mongodb://localhost:27017/freecodecamp
var MONGO_KEY = process.env.MONGO_KEY;
var SITE_URL = 'https://rk-url-shortener-microservice.herokuapp.com/';	//TODO: Need to be a environment variable
var MONGO_DB_URL_COL = "shorturl";

//TODO Use these consts instead of using the strings
var FIELD_SHORT_ID = "short_id";
var FIELD_ORGINAL_URL = "original_url";


//Helpers
function findRow(doc, col, callback) {
	col.find(doc).toArray(function(err, documents){
		console.log("findRow result " + JSON.stringify(documents));
		if(!err)
		{
			callback(null, documents);
		}
		else
			callback(err, null);
	});
}
function insertRow(doc, col, callback) {
	var update = doc;
	col.insert(doc, {strict: false}, function(err, result) {
		console.log("insertRow result " + JSON.stringify(result));
		if(err)
		{
			callback(err, null);
		}
		else
		{
			callback(null, result.ops[0]);
		}
	});	
}


app.get('/', function(req, res){
	console.log("root");
	res.sendFile(path.join(__dirname + '/public/index.html'));
});
app.get('/new/*', function(req, res){
	console.log("new");
	//console.log(req.params);
	var url = req.params['0'];
	if(!isUrl(url))
	{
		var retval = {};
		retval.error = "Failed to generate a short url as the given string is not a url";
		res.setHeader('Content-Type', 'application/json');
		res.send(JSON.stringify(retval));
	}
	else
	{
		mongo.connect(MONGO_KEY, function(err, db) {
			var shortId = shortHash.unique(url);
			findRow({'short_id': shortId}, db.collection(MONGO_DB_URL_COL), function(err, documents){
				console.log("find err:" + JSON.stringify(err));
				console.log("find doc:" + JSON.stringify(documents));
				if(!err && documents.length == 0 || err)	//means its not inserted or there was some problem finding
				{
					//try to insert
					var doc = {'original_url': url, 'short_id': shortId};		//TODO: assuming no collisions
					insertRow(doc, db.collection(MONGO_DB_URL_COL), function(err, document) {
						var retval = {};
						if(!err && document)
						{
							retval.original_url =document['original_url'];
							retval.short_url = SITE_URL + document['short_id'];
						}
						else
						{
							retval.error = "Failed to insert the url";	//TODO: localization		
						}
						res.setHeader('Content-Type', 'application/json');
						res.send(JSON.stringify(retval));
						db.close();
					})
				}
				else if(!err)	//its already present in the database
				{
					var retval = {};
					retval.original_url =documents[0]['original_url'];	//For now, assuming there wont be any collisions
					retval.short_url = SITE_URL + documents[0]['short_id'];
					res.setHeader('Content-Type', 'application/json');
					res.send(JSON.stringify(retval));
					db.close();
				}
			});

		});
	}
});

app.get('/init', function(req, res){
	console.log("init");
	mongo.connect(MONGO_KEY, function(err, db) {
		// db.collection(MONGO_DB_URL_COL).drop();
		// res.send("done");
		db.createCollection(MONGO_DB_URL_COL, {strict:false}, function(err, collection){
			if(err)
				console.log("err " + JSON.stringify(err));
			else
				console.log(MONGO_DB_URL_COL + " collection is ready to use.");

			db.collection(MONGO_DB_URL_COL).createIndex( { "original_url": 1,  'short_id': 1}, { unique: true }, function(err, result){
				console.log(err);
				console.log(result);
				db.close();
				res.send("done");		
			})
		});
	});
});

app.get('/:shortId', function(req, res){
	console.log("shortId");
	var shortId = req.params.shortId;
	mongo.connect(MONGO_KEY, function(err, db) {
		findRow({'short_id': shortId}, db.collection(MONGO_DB_URL_COL), function(err, documents){
			db.close();
			if(!err && documents.length > 0)
			{
				res.redirect(documents[0]['original_url']);
			}
			else
			{
				res.setHeader('Content-Type', 'application/json');
				res.send('{"error": "No site registered with this url"}');
			}
		});
	});
});

app.listen(process.env.PORT || 4000);

