"use strict";
const { spawn } = require('child_process');
const https = require('https');
const fs = require('fs');

// This version of bones/manager has been modifed for Mew Mew's Wheat Farmers' Association
// Last Modified 2024-03-26

const serverCommand=(str)=>service.stdin.write(`${str}\n`);
var STATE = "PREP";

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
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1192750560449933342/redacted?wait=true',method:'POST',headers:{'user-agent':'node/bones','Accept':'*/*','content-type':'application/json'}},
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1192750620747251723/redacted?wait=true',method:'POST',headers:{'user-agent':'node/bones','Accept':'*/*','content-type':'application/json'}},
  {hostname:'canary.discord.com',port:443,path:'/api/webhooks/1192750683028471849/redacted?wait=true',method:'POST',headers:{'user-agent':'node/bones','Accept':'*/*','content-type':'application/json'}},
];
var java = '/home/mint/Downloads/jdk-17.0.9/bin/java'
var linkedChannel = '1192750533912571925'
const ADVANCEMENTS = (fs.readFileSync("advancements.txt")+"").split("\n");

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

  if (postData.content)
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

  /* redacted */
}
var usernameMap = {
  '163718745888522241': 'IceSelkie',
  /* redacted */

  /* redacted */
}
function getAvatar(sender) {
  if (avatarMap[sender]) {
    let avatar = avatarMap[sender];
    if (avatar.includes("/"))
      return "https://cdn.discordapp.com/attachments/1001839393188876399/"+avatar;
    else
      return "https://redacted/firecache/"+avatar;
  }
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


// This is the Minecraft process. Set in the function `startMinecraftServer`.
var service = null;


let prevdat = "";
let i=0;

let listQty = null;
let listRequested = null;

function startMinecraftServer() {
  // java -Xmx3G -Xms2G -jar Tekkit.jar nogui 2>&1 | tee console.log
  service = spawn("sh",['start.sh']);
  STATE = "START";


  // Listeners:
  // When your service writes to stdout
  service.stdout.on('data', runData);

  // When your service writes to stderr (optional, but useful for debugging)
  service.stderr.on('data', (data) => {
    console.error(['Service STDERR:'], data);
    let msg = "Server stderr detected: "+JSON.stringify(data);
    send({content:msg.substring(0,1950)});
  });

  // When your service exits (optional, but useful for debugging)
  service.on('close', (code) => {
    console.log(`Service exited with code ${code}`);

    if (STATE !== "STOPPING") {
      send({content:"Server process detached. Assuming crashed, and restarting..."});
      startMinecraftServer();
    }
  });

  // Listen for the 'error' event, which indicates that there was an error starting the child process
  service.on('error', (err) => {
    console.error(`Failed to start bash script: ${err}`);
    send({content:"Start script error: "+err});
  });
}

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
        let chatQty = RegExp(/There are ([0-9]+)(?:\/| of a max of )[0-9]+ players? online:(.*)$/).exec(message)?.slice(1);
        if (chatQty?.[1]) listQty = chatQty[1].split(",").length
        let chatCmdList = RegExp(/\[Server thread\/INFO\]: <([^\<\>]+)> ~list$/).exec(message)?.slice(1);
        if (chatCmdList) {
          service.stdin.write('list\n');
          console.error(["########"],'"~list" Seen! Listing...');
          listRequested = chatCmdList[0];
          listQty = null;
          done = true;
        }
        else if ((listQty||chatQty?.[1]) && message.includes('[Server thread/INFO]: ')) {
          console.error(["########"],'"~list" continuing...');
          let online = chatQty[1] || ` ${message.substring(46)}`;
          let msg = `${listQty} Player${listQty=="1"?"":"s"} Online:${online}`;
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
        if (message.endsWith(' [Server thread/INFO]: <IceSelkie> ~stop')) {
          shutdown();
          done = true;
        }
      }

      // Join verification
      if (!done) {
        if (message.includes("logged in with")) {
          let data = RegExp(/.*?\]: ([^ ]+)\[.*/)[1]; // modified for 1.20.4

          console.error([12344321],message);
          console.error([12344321],data);
          done = true;
        }
      }

      // Join Leave Nick messages
      if (!done) {
        let chat = RegExp(/\[Server thread\/INFO\]: (.*? joined the game|.*? left the game|[^\.:]*? lost connection.*|.*? is now known as .*)$/).exec(message)?.slice(1);
        if (chat && !chat[0].includes("logged in with entity id")) {
          console.log(chat);
          send({content:chat[0]})
          done = true;
        }
      }

      // Start Stop messages
      if (!done) {
        let chat = RegExp(/\[Server thread\/INFO\]: (Stopping the server|Stopping server|Preparing level \"world\")$/).exec(message)?.slice(1);
        if (chat) {
          console.log("#### start stop message ####",chat);
          send({content:chat[0]=="Preparing level \"world\""?"Server started.":"Server stopped."});
          done = true;
        }
      }

      // Chat Messages
      if (!done) {
        let chat = RegExp(/\[Server thread\/INFO\]: <([^\<\>]+)> (.*)$/).exec(message)?.slice(1);
        if (chat) {
          let user = chat[0];
          let msg = chat[1].trim() || ":warning: _unknown message_";

          send({content:msg},user)
          done = true;
        }
      }

      if (!done) {
        let adv = RegExp(/\[Server thread\/INFO\]: ((.+) has made the advancement \[(.+)\])/).exec(message)?.slice(1);
        if (adv) {
          let [str, user, advname] = adv;
          let msg = advancementToEmbed(advname);
          if (msg)
            send(msg,user);
          else
            send({content:str});
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

function advancementToEmbed(advname) {
  try {
    const parser = /<b>(.*?)<br><span.*? id="(.*?)"><td>(.*?)<\/td><code>([^<]+).*?"(.*?)">/;
    let adv = ADVANCEMENTS.find(adv=>adv.includes(`>${advname}<`));
    let [title,anchor,desc,code,icon] = parser.exec(adv).slice(1);
    return {"embeds":[{
        "description": `${desc}`,
        "color": 14393877,
        "author": {"name":`${title}`, "url":`https://minecraft.wiki/w/Advancement#${anchor}`, "icon_url":`https://minecraft.wiki${icon}`},
        "footer": {"text":`${code}`}
      }]};
  } catch (ignored) {
    return null;
  }
}

function shutdown() {
  STATE = "STOPPING";
  console.error(["########"],'Closing server. Exiting in 15s.');
  send({content:"Shutdown requested..."});
  heartbeatShouldBeRunning = false;
  ws.close(1000);
  serverCommand("stop");
  setTimeout(()=>exit(0),15000);
}

startMinecraftServer();





















































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
  if (errcode === 1001) {
    start(sessionID);
  } else if (errcode === 1006) {
    console.log("Unexpected client side disconnect... Reconnecting in 4 seconds...");
    setTimeout(()=>start(sessionID), 4000);
  } else {
    // Reset bot and attempt reconnect.
    setTimeout(()=>{
      // If we want to stop, dont restart
      if (!connected && STATE!=="STOPPING") {
        ws = null; sessionID = null; lastSequence = 0; printAllDisbatches = true; botUser = null;
        heartbeatInterval = null; heartbeatShouldBeRunning = false; lastHeartbeat = null;
        start();
      } else {
        console.log("Aborting restart...");
      }
    }, 5000);
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

    if (message.t === "MESSAGE_CREATE") {
      if (message.d.content === "~list") {
        listRequested = message.d.author;
        serverCommand('list');
        listQty = null;
      } else if (message.d.content === "~stop" && message.d.author.id === "163718745888522241") {
        shutdown();
      } else if (message.d.content.startsWith("~") && message.d.author.id === "163718745888522241") {
        // pass command to minecraft server
        serverCommand(message.d.content.substring(1));
      }

      // debug RCE
      const botPing = `<@${botUser.id}> execute`;
      if (false && message.d.author.id === "163718745888522241" && message.d.content.startsWith(botPing)) {
        let msg = message.d.content.substring(botPing.length);
        let output = undefined;
        try {
          output = eval(msg.substring(8));
        } catch (e) {
          output = e;
        }
        send({content:String(output)});
      }
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
};


// Add timestamps to logs for debugging.
const dateFromStr=(str) => new Date(str.replaceAll(/[^0-9]+/g,"").split(/(..?)/).filter((a,i)=>i%2).splice(0,9).join("X").replace("X","").replace("X","-").replace("X","-").replace("X","T").replace("X",":").replace("X",":").replace("X",".").replaceAll("X","")+"Z");
const dateToStr=(date=new Date()) => new Date(date).toISOString().replaceAll(/[-:Z\.]+/g,"");
const oldConsoleLog = console.log;
const oldConsoleError = console.error;
console.log = function(...args) {
  // Add date
  args=["["+dateToStr()+"]", ...args];
  // Pass through to original console.log
  oldConsoleLog(...args);
};
console.error = function(...args) {
  // Add date
  args=["["+dateToStr()+"]", ...args];
  // Pass through to original console.error
  oldConsoleError(...args);
};

// Start the actual bot.
STATE = "RUNNING";
start();

