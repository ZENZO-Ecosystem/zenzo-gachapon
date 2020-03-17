const fs = require("fs");
const superagent = require('superagent');
const CryptoRPC = require('bitcoin-rpc-promise');
const Discord = require('discord.js');

// CONFIG --- TODO: Add an actual config file so you don't have to edit the code everytime you change the config >:3
const authKey = ""; // Your Forge auth.key
const botToken = ""; // Discord bot token
var zenzo = new CryptoRPC('http://username:password@localhost:22610'); // Your ZENZO Core authenication (from zenzo.conf file)

var bot = new Discord.Client()
bot.on('ready', function () {
  console.log('Logged in! Serving in ' + bot.guilds.array().length + ' servers')
});


async function getForgeInventory (addr) {
  let items = [];
  let res = await superagent.post('http://127.0.0.1:80/forge/items');
  res = JSON.parse(res.text);
  for (let i=0; i<res.items.length; i++) {
    if (res.items[i].address === addr) items.push(res.items[i]);
  }
  return items;
}

async function getForgeProfile (addr) {
  let items = [];
  let res = await superagent.post('http://127.0.0.1:80/forge/profiles');
  res = JSON.parse(res.text);
  for (let i=0; i<res.length; i++) {
    if (res[i].address === addr || res[i].name.replace("zenzo.", "").toLowerCase() === addr.toLowerCase()) {
      return res[i];
    }
  }
  return null;
}

async function getForgeProfiles () {
  let res = await superagent.post('http://127.0.0.1:80/forge/profiles');
  res = JSON.parse(res.text);
  return res;
}

async function hasDeposited (addr) {
    var txs = await zenzo.call("listunspent");
    if (txs.length === 0) return false;
    var i = 0, len = txs.length, bal = 0;
    for (i=0; i<len; i++) {
      if (txs[i] && txs[i].amount && txs[i].address === addr && txs[i].amount > 0) {
        bal += txs[i].amount;
      }
    }
    console.log("Address '" + addr + "' has deposited " + bal + " ZNZ");
    if (bal >= 5.01) {
        return true;
    } else {
        return false;
    }
}

let currentPlayer = null;
let currentDepositAddr = null;
let currentPlayerAddr = null;
let currentMsg = null;

let depReceived = false;

bot.on('message', msg => {
    var messageParts = msg.content.split(' ');
    var command = messageParts[0].toLowerCase();
    var parameters = messageParts.splice(1, messageParts.length);

    if (command === "zroll") {
        if (currentPlayer !== null) return msg.reply("someone is already playing! Please wait your turn.");
        if (parameters[0]) {
            zenzo.call("getnewaddress", "gachapon").then(nAddr => {
                currentDepositAddr = nAddr;
                currentPlayerAddr = parameters[0];
                currentPlayer = msg.author;
                currentMsg = msg;
                msg.channel.send(msg.author);
                var embed = {
                  "title": "ZENZO Gachapon | Insert Coins!",
                  "color": 3719178,
                  "footer": {
                    "text": "The ZENZO Gachapon Bot - Powered by ZENZO Forge"
                  },
                  "fields": [
                    {
                      "name": "Please send exactly **5.01 ZNZ** to this address. Once it confirms, I'll send your prize!",
                      "value": "`" + currentDepositAddr + "`"
                    }
                  ],
                  "thumbnail": {
                    "url": "https://cdn.discordapp.com/emojis/461218822666453003.png?v=1"
                  }
                }
                msg.channel.send({embed})
                let checkInterval = setInterval(function(){
                    hasDeposited(currentDepositAddr).then(received => {
                        if (received && !depReceived) {
                            depReceived = true;
                            superagent
                            .post('http://127.0.0.1:80/forge/create')
                            .send({amount: 5.001, name: "Gachapon Prize (ガシャポンカプセル)", auth: authKey})
                            .end((err, res) => {
                                res = JSON.parse(res.text);
                                console.log(JSON.stringify(res))
                                msg.channel.send(msg.author);
                                embed = {
                                  "title": "ZENZO Gachapon | Gacha Gacha Gacha!..",
                                  "color": 3719178,
                                  "footer": {
                                    "text": "The ZENZO Gachapon Bot - Powered by ZENZO Forge"
                                  },
                                  "fields": [
                                    {
                                      "name": "Status:",
                                      "value": "Your ZNZ has been received! **Gachapon Machine Turning...** Your prize will arrive in your inventory in a couple of minutes!"
                                    }
                                  ],
                                  "thumbnail": {
                                    "url": "https://cdn.discordapp.com/emojis/680810982108299283.gif?v=1"
                                  }
                                }
                                msg.channel.send({embed})
                                setTimeout(function(){
                                    superagent
                                    .post('http://127.0.0.1:80/forge/transfer')
                                    .send({item: res.tx, to: currentPlayerAddr, auth: authKey})
                                    .end((err, res) => {
                                        console.log(JSON.stringify(res))
                                        msg.channel.send(msg.author);
                                        embed = {
                                          "title": "ZENZO Gachapon | Prize!",
                                          "color": 3719178,
                                          "footer": {
                                            "text": "The ZENZO Gachapon Bot - Powered by ZENZO Forge"
                                          },
                                          "fields": [
                                            {
                                              "name": "Status:",
                                              "value": "Your prize has been delivered. <:ZENZOGift:427021247243747340> Check your inventory!"
                                            }
                                          ],
                                          "thumbnail": {
                                            "url": "https://cdn.discordapp.com/emojis/427021247243747340.png?v=1"
                                          }
                                        }
                                        msg.channel.send({embed})
                                        currentPlayer = null;
                                        currentPlayerAddr = null;
                                        depReceived = false;
                                        currentDepositAddr = null;
                                        clearInterval(checkInterval);
                                    });
                                }, 150000);
                            });
                        }
                    });
                }, 5000);
            });
        } else {
            msg.reply("Please enter a valid ZENZO Forge Address!");
        }
    }
})

bot.login(botToken);
