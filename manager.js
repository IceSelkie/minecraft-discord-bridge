"use strict";
const { spawn } = require('child_process');
const https = require('https')

// // Private
// var webhooks=[
//   {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130608378993967104/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}},
//   {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130617575026458645/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}},
//   {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130660146004111430/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}}
// ];
// var java = "/Library/Java/JavaVirtualMachines/jdk1.8.0_371.jdk/Contents/Home/bin/java"
// var linkedChannel = '1130607884867207258'

// Public
var webhooks=[
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130700725891113141/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}},
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130700759676235816/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}},
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1130700778840010802/redacted?wait=true',method:'POST',headers:{'user-agent':'node/tekkit','Accept':'*/*','content-type':'application/json'}}
];
var java = '/home/mint/Downloads/jre1.8.0_371/bin/java'
var linkedChannel = '1130700639199035392'

var whid = 2;
var lastSender = "Server";

function send(postData,sender="Server") {
  if (sender !== lastSender)
    whid = (whid+1)%(webhooks.length-1);
  lastSender = sender

  postData.username = sender;
  let avatar = getAvatar(sender)
  if (avatar)
    postData.avatar_url = avatar;

  postData.content = cleanup(postData.content);

  console.log(`Attempting to send (${whid}): ${JSON.stringify(postData)}`)
  var req = https.request(webhooks[whid],res=>console.log('statusCode:', res.statusCode));
  req.write(JSON.stringify(postData));
  req.end();
}

var avatarMap = {
  'Server': '1130657993415983154/tekkit_cropped.png',
  'IceSelkie': '1130652138800951457/163718745888522241_3bb5bfa826fa59167533f6380127d59e.webp',
  /* redacted */
}
var usernameMap = {
  '163718745888522241': 'IceSelkie',
  /* redacted */
}
function getAvatar(sender) {
  if (avatarMap[sender])
    return "https://cdn.discordapp.com/attachments/1001839393188876399/"+avatarMap[sender];
  return null;
}
function getUsername(user, nick) {
  if (usernameMap[user.id])
    return usernameMap[user.id];
  return nick || user?.global_name || user?.username || "Unknown User";
}

function cleanup(string) {
  string = string.split(/([*_|~\\])/).filter(a=>a).map(a=>"*_|~\\".includes(a)?"\\"+a:a).join("");
  if (string.startsWith("-") || string.startsWith(">"))
    string = '\\'+string;
  return string;
}


// java -Xmx3G -Xms2G -jar Tekkit.jar nogui 2>&1 | tee console.log
var service = spawn("sh",['start.sh']);

let prevdat = "";
let i=0;


let listQty = null;
let listRequested = null;

var runData = (data) => {
  let messages = prevdat + data.toString();
  messages = messages.split("\n");
  prevdat = messages.splice(messages.length-1);

  for (let message of messages) {
    // message = message.trim();
    // // forward to stdout
    // console.log((ct?a:b)+message);
    // ct = !ct;
    console.log(i,JSON.stringify(message));

    let done = false;

    try {
      // List Command:
      if (!done) {
        let chatQty = RegExp(/There are ([0-9]+)\/[0-9]+ players online:$/).exec(message)?.slice(1);
        let chatCmdList = RegExp(/\[Minecraft-Server\] <([^\<\>]+)> ~list$/).exec(message)?.slice(1);
        if (chatCmdList) {
          service.stdin.write('list\n');
          // console.error(["########"],'"list" Seen! Listing...')
          listRequested = chatCmdList[0];
          listQty = null;
          done = true;
        }
        else if (listQty && message.includes(" [INFO] [Minecraft-Server] ")) {
          let msg = `${listQty} Player${listQty=="1"?"":"s"} Online: ${message.substring(46)}`;
          service.stdin.write(`say ${msg}\n`);
          send({content:msg});
          listQty = null;
          listRequested = null;
          done = true;
        } 
        else if (listRequested && chatQty) {
          listQty = chatQty[0];
          done = true;
        }
      }

      // Stop command
      if (!done) {
        if (message.endsWith(' [INFO] [Minecraft-Server] <IceSelkie> ~stop')) {
          service.stdin.write('stop\n');
          console.error(["########"],'Closing server.')
          setTimeout(()=>exit(0),15000)
          done = true;
        }
      }

      // Join verification
      if (!done) {
        if (message.includes("logged in with")) {
          let data = RegExp(/.*?r\] ([^ ]+).*/)[1];

          console.error(["########"],message);
          console.error(["########"],data);
          done = true;
        }
      }

      // Join Leave Nick messages
      if (!done) {
        let chat = RegExp(/\[Minecraft-Server\] (.*? joined the game|.*? left the game|[^\.:]*? lost connection.*|.*? is now known as .*)$/).exec(message)?.slice(1);
        if (chat && !chat[0].includes("logged in with entity id")) {
          console.log(chat);
          send({content:chat[0]})
          done = true;
        }
      }

      // Start Stop messages
      if (!done) {
        let chat = RegExp(/\[Minecraft-Server\] (Stopping the server|Preparing level \"world\")$/).exec(message)?.slice(1);
        if (chat) {
          console.log(chat);
          send({content:chat[0]=="Stopping the server"?"Server stopped.":"Server started."})
          done = true;
        }
      }

      // Chat Messages
      if (!done) {
        let chat = RegExp(/\[Minecraft-Server\] <([^\<\>]+)> (.*)$/).exec(message)?.slice(1);
        if (chat) {
          let user = chat[0];
          let msg = chat[1].trim() || ":warning: _unknown message_";

          send({content:msg},user)
          done = true;
        }
      }

      // // Dimension Loading messages
      // if (!done) {
      //   if (message.includes("Created Retrogen database for dimension")) {
      //     let dimension = message.split(" ").slice(-1)[0];
      //     if (dimension !== -1)
      //       send({content:"Loaded Dimension "+dimension},"Dimensions")
      //     done = true;
      //   }
      //   else if (message.includes("[ForgeModLoader] Unloading dimension")) {
      //     let dimension = message.split(" ").slice(-1)[0];
      //     if (dimension !== -1)
      //       send({content:"Unloaded Dimension "+dimension},"Dimensions")
      //     done = true;
      //   }
      // }

    } catch (e) {
      console.error(e);
    }
  }
  i++;
}



// When your service writes to stdout
service.stdout.on('data', (a,b,c) => runData(a,b,c));

// When your service writes to stderr (optional, but useful for debugging)
service.stderr.on('data', (data) => {
  console.error(['Service STDERR:'], data);
});

// When your service exits (optional, but useful for debugging)
service.on('close', (code) => {
  console.log(`Service exited with code ${code}`);
});


























































"use strict";
const WebSocket = require("ws").WebSocket;

var identity = {"intents":33280,"properties":{"$device":"bones","$browser":"node","$os":process.platform},
"token":"redacted"};

var ws = null;
var connected = false;
var sessionID = null;
var lastSequence = 0;
var printAllDisbatches = true;

var heartbeatInterval = null;
var heartbeatShouldBeRunning = false;
var lastHeartbeat = null;

var botUser = null;

function start(sid=null, last=null) {
  ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
  ws.on('open', () => wsOnOpen(sid, last));
  ws.on('close', (errcode, buffer) => wsOnClose(errcode, buffer));
  ws.on('message', (message) => wsOnMessage(message));
}
function wsSend(webhookPacket) {
  console.log("Sending:")
  console.log(JSON.stringify(webhookPacket,null,2))
  if (connected)
    ws.send(JSON.stringify(webhookPacket,null));
  else
    console.log("Failed to send. Connection is dead.")
}
function wsOnOpen(sid, last) {
  connected = true;
  if (sid === null)
    wsSend({"op":2,"d":identity});
  else {
    if (last !== null)
      lastSequence = last;
    wsSend({"op":6,"d":{"token":identity.token,"session_id":sid,"seq":lastSequence}});
  }
}
function wsOnClose(errcode, buffer) {
  connected = false;
  console.log('disconnected:');
  console.log(errcode);
  console.log('"'+buffer.toString()+'"');
  // Reconnect Requested:
  if (errcode === 1001)
    start(sessionID);
  if (errcode === 1006) {
    console.log("Unexpected client side disconnect... Reconnecting in 4 seconds...");
    setTimeout(()=>start(sessionID), reconnectheartbeatInterval);
  }
}
function heartbeat() {
  if (!connected || !heartbeatShouldBeRunning) {
    console.log("[hb] Heartbeat shouldnt be running. Stopping.");
    heartbeatShouldBeRunning = false;
    lastHeartbeat = 0;
    return;
  }
  if (Date.now()>=lastHeartbeat+heartbeatInterval) {
    console.log("[hb] Ba-Bum. Heartbeat sent for message "+lastSequence+".");
    ws.send(JSON.stringify({"op":1,"d": lastSequence}));
    lastHeartbeat = Date.now();
  }
  setTimeout(()=>heartbeat(),250);
}
function wsOnMessage(message) {
  let message_time = Date.now();
  message = JSON.parse(message);
  message.time = message_time;
  if (printAllDisbatches) console.log(JSON.stringify(message));
  if (message.s) lastSequence = message.s;

  // hb-ack
  if (message.op==11 && message.s==null && message.d==null) {
    console.log("Received message (none/heartbeat-ack) "+message_time);
  } else
  if (message.t==='RESUMED') {
    console.log("Received message (none/RESUMED)");
    console.log(message)
  }

  // Hello
  if (message.op === 10) {
    console.log("Received message (none/hello)");
    console.log(message)

    // Start heartbeat
    heartbeatInterval = message.d.heartbeat_interval;
    lastHeartbeat = (+new Date())-heartbeatInterval*Math.random();
    if (heartbeatShouldBeRunning)
      console.error("[hb] Already running!");
    else {
      heartbeatShouldBeRunning = true;
      heartbeat();
    }
  } else
  // Send Heartbeat ASAP
  if (message.op === 1) {
    console.log("[hb] Early heartbeat requested.");
    lastHeartbeat = 0;
  } else
  // Resume Successful
  if (message.op === 7) {
    console.log("Successful reconnection!");
  } else
  // Resume Failed
  if (message.op === 9) {
    console.error("Reconnect failed. Please start a new session.");
  } else

  // Standard Dipatch
  if (message.op === 0) {
    if (message.t === "READY") {
      sessionID = message.d.session_id;
      botUser = message.d.user;
      let name = botUser.global_name ? (botUser.global_name+" ("+botUser.username+")") : (botUser.username+"#"+botUser.discriminator);
      console.log("Connection READY: Logged in as "+name+" <@"+botUser.id+"> "+(botUser.bot?"[bot]":"<<selfbot>>") + " -> "+sessionID)
    }
    console.log("Dispatch received: "+message.t+" id="+message.s)

    // Process other disbatches received
    if (message.t === "MESSAGE_CREATE" && !message.d.author.bot && message.d.channel_id == linkedChannel) {
      let sender = getUsername(message.d.author,message.d.member?.nick);
      let text = message.d.content;
      text = text.split(/([@\n])/).filter(a=>a).map(a=>a=="@"?"@ ":a=="\n"?" ":a).join("");
      console.log(`say <${sender}>: ${text}\n`);
      service?.stdin.write(`say <${sender}>: ${text}\n`);
    }
  }
}

// Start the actual bot.
start();

