//Heroku requires a visit to the webpage every hour, or it shuts down the dyno; this bypasses that.
//At the bottom of this file is an example of a basic webserver + pinger to make the bot keep itself alive.
//You need to simply edit the Procfile (if you change the .js filename) and set a config option (APP_URL) pointing to your herokuapp domain before running.
//Visiting the page /stats will result in a simple statistics (same as those generated by the botinfo trigger)
//Visiting the page /stats as a json request will return the same information as json (try it with request using option json:true) 
//Visiting any page ending in log will return that logfile (if it exists). Suggested not to serve *all* pages, as someone could get your config.

//These are needed for the webserver part (see the bottom), which adds some basic stats and serves logs
var express = require("express");
var request = require("request");
var hostname = "localhost"		//set this to the hostname to be used when pinging yourself.  This will not be used if you set an APP_URL env variable in heroku
var localport = 5001;			//set this to the local port expressjs should bind to during testing or in non-heroku situations (the script fetches heroku's APP_PORT automatically)
var startTime = process.hrtime();       	//leave this alone

//Default is to set a config option for the username and password.
//To define config options, use `heroku config:set name=settingvalue`, e.g. username=chatbot or password=50m3_P4w0rD or APP_URL=chatbots.heroku.com
//For details see https://devcenter.heroku.com/articles/config-vars
var username = process.env.username || "";
var password = process.env.password || "";

//Optional Firebase config storage, since Heroku doesn't persist local file writes
//Very useful if you don't want to keep entering Steam Guard code for example
var firebaseURL = process.env.FIREBASE_URL || "";
var firebaseSecret = process.env.FIREBASE_SECRET || "";



var _ = require("underscore");
var ChatBot = require("./").ChatBot;

var chatBotOptions = {
//	sentryFile: "",		//Bot tries to find a sentry file automatically. This is only required if you have one with a strange name, otherwise it's automatic.
//	guardCode: "",		//guardCode will override a sentry file. Comment this out after the first use.
	logFile: true,          //set to true to log to bot.$username.log, or define a custom logfile. Set to false if you don't want to log to file.
	autoReconnect: true,    //automatically reconnect to the server
	consoleTime: false,     //don't put timestamps in the console log, `heroku logs` shows them anyways
	consoleColors: false,   //don't use colors in the log. using `heroku logs` will be annoying.
	consoleLogLevel: "warn" //don't log chatter to console, it's spammy. Only log warnings, errors, etc.
};

if(process.env.guardCode) {
	chatBotOptions.guardCode = process.env.guardCode;
}

// Default triggers
var triggers = require("./example-config-triggers2");
var myBot;

if (firebaseURL && firebaseSecret) {
	var Firebase = require("firebase");
	var fbRef = new Firebase(firebaseURL);

	fbRef.authWithCustomToken(firebaseSecret, onFirebaseAuth);
} else {
	console.log("not using firebase");
	myBot = new ChatBot(username, password, chatBotOptions);
	myBot.addTriggers(triggers);
	myBot.connect();
}

function onFirebaseAuth(error, authData) {
	if (error) {
		console.error("Firebase login failed", error);
	} else {
		console.log("Firebase login successful");
		fbRef.child("config").once("value", onConfigLoadedFromFirebase);
	}
}

function onConfigLoadedFromFirebase(snapshot) {
	console.log("Fetched bot config from Firebase");
	chatBotOptions.config = snapshot.val()
	myBot = new ChatBot(username, password, chatBotOptions);
	
	fbRef.child("triggers").on("value", onTriggersChanged);

	myBot.on("configChanged", storeConfigToFirebase);
	myBot.connect();
}

function storeConfigToFirebase(key, val) {
	fbRef.child("config").child(key).set(val);
}

function onTriggersChanged(snapshot) {
	console.log("Received updated triggers from Firebase");
	
	var fbTriggers;
	if (snapshot.val()) {
		fbTriggers = snapshot.val();
	} else {
		fbTriggers = triggers;
		fbRef.child("triggers").set(fbTriggers);
	}
	myBot.clearTriggers();
	myBot.addTriggers(fbTriggers);
}

// Trigger details can be retrieved and reloaded so that external configuration can be supported
//var details = myBot.getTriggerDetails();
//myBot.clearTriggers();
//myBot.addTriggers(details);

//these are useful for displaying your bot as playing a game, so it shows up in the upper part of the userlist.
//this is a comma-separated array of games that the bot will play automatically on login. 440 is tf2.
//myBot.setGames([440]);
//this will stop all games, start the game listed (the first parameter), then after a delay in ms (the second param), start any games it was already playing. 570 is dota2.
//myBot.setPrimaryGame(570,250);














var pingcount = 0;
function getClientIp(req) {
	var ipAddress;
	// Amazon EC2 / Heroku workaround to get real client IP
	var forwardedIpsStr = req.header("x-forwarded-for"); 
	if (forwardedIpsStr) {
		// "x-forwarded-for" header may return multiple IP addresses in
		// the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
		// the first one
		var forwardedIps = forwardedIpsStr.split(",");
		ipAddress = forwardedIps[0];
	}
	if (!ipAddress) {
		// Ensure getting client IP address still works in
		// development environment
		ipAddress = req.connection.remoteAddress;
	}
	return ipAddress;
};
_bytesToSize = function(bytes) {
    var sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    if (bytes == 0) return "0 Byte";
    var i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i), 2) + " " + sizes[i];
}
Number.prototype.toHHMMSS = function () {
	var sec_num = parseInt(this, 10); // don't forget the second param
	var days    = Math.floor(sec_num / 86400);
	var hours   = Math.floor((sec_num - (days * 86400)) / 3600);
	var minutes = Math.floor((sec_num - (days * 86400) - (hours * 3600)) / 60);
	var seconds = sec_num - (days * 86400) - (hours * 3600) - (minutes * 60);

	if (hours   < 10) {hours   = "0"+hours;}
	if (minutes < 10) {minutes = "0"+minutes;}
	if (seconds < 10) {seconds = "0"+seconds;}
	return (days>0?days+":":"")+hours+":"+minutes+":"+seconds;
}
getStats = function() {
	var meminfo = process.memoryUsage();
        var time = process.hrtime(startTime);
            time = time[1] + time[0]*1000000000;
        return {"timeNS":time,"time":(time/1000000000).toHHMMSS(),"platform":process.platform,"arch":process.arch,"heapUsed":meminfo.heapUsed,"heapTotal":meminfo.heapTotal,"rss":meminfo.rss,"version":process.version,"pingcount":pingcount}
}
getStatsString = function() {
	var meminfo = process.memoryUsage();
	var curtime = process.hrtime(startTime);
	curtime = curtime[1] + curtime[0]*1000000000;
	var message  = "I have been running for about " + (curtime/1000000000).toHHMMSS();
	message += " on " + process.platform + "/" + process.arch;
	message += ", using " + _bytesToSize(meminfo.heapUsed) + " of " + _bytesToSize(meminfo.heapTotal) + " allocated memory (RSS: " + _bytesToSize(meminfo.rss);
	message += "). Node.js version is "+process.version+". I have been pinged "+pingcount+" times.";
	return message;
}

_nanosecondsToStr = function(seconds, goagain) {
    var temp = seconds;
    function numberEnding (number) {return (number > 1) ? "s" : "";}

    if(temp > 259200) {
        var temp = Math.floor(temp / 86400);
        var next = (goagain==true ? _nanosecondsToStr(seconds-temp*86400,false) : "");
        return " " + temp + " day" + numberEnding(temp) + next;
    } else if (temp > 10800) {
        var temp = Math.floor(temp / 3600);
        var next = (goagain==true ? _nanosecondsToStr(seconds-temp*3600,false) : "");
        return " " + temp + " hour" + numberEnding(temp) + next;
    } else if (temp > 180) {
        var temp = Math.floor(temp / 60);
        var next = (goagain==true ? _nanosecondsToStr(seconds-temp*60,false) : "");
        return " " + temp + " minute" + numberEnding(temp) + next;
    } else return (goagain==true ? " less than a minute" : "");
}

var app = express();
app.get("/", function(req, res) {
	res.send("This is a private server! You shouldn't be here!");
	console.log(res);
//	console.log(getClientIp(req)+" tried to view us!");
});

app.get("/ping", function(req, res) {
	res.send("Ping count: "+pingcount);
	console.log("Pinged! Count: "+pingcount);
	pingcount++;
});
app.get("/stats", function(req, res) {
	console.log("Accepts JSON?", req.accepts("text/html") !== undefined);
	if(req.accepts("text/html")) 
		res.send(getStatsString());
	else
		res.send(JSON.stringify(getStats()));
	console.log(getClientIp(req)+" retrieved stats");
});
app.get("/stats.js", function(req, res) {
	res.send(JSON.stringify(getStats()));
	console.log(getClientIp(req)+" retrieved stats.js");
});

// serves all the logfiles
app.get(/^(.+.log)$/, function(req, res){ 
	console.log(getClientIp(req)+" requested "+req.params[0]);
	res.sendFile( __dirname + req.params[0]); 
});

var port = process.env.PORT || localport;
app.listen(port, function() {
	console.log("Listening on " + port);
});

var pingself = function(){
	var uri = process.env.APP_URL ? (process.env.APP_URL+"/ping") : ("http://"+hostname+"/ping");
	console.log("Pinging uri "+uri);
	request.get({method:"GET",encoding:"utf8",uri:uri,followAllRedirects:true}, function(error, response, body) {
		if(error) console.log(error);
		else console.log(body);
	});
}
var fetchstats = function(self){
	console.log("Pinging self");
	request.get({method:"GET",encoding:"utf8",uri:"http://"+hostname+"/stats",json:true,followAllRedirects:true}, function(error, response, body) {
		if(error) console.log(error);
		else console.log(body);
	});
}
setInterval(function(){pingself()}, process.env.PING_INTERVAL || 1800000);
