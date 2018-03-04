var https = require('https');
var redis = require('redis');
var person = require('./person.js');

function get_user_profile(userId) {
    var promise = new Promise(function(resolve, reject) {
        var get_options = {
            host: 'api.line.me',
            port: '443',
            path: '/v2/bot/profile/' + userId,
            method: 'GET',
            headers: {
                'Authorization': 'Bearer qUx2A3XbaFps24H+cP41TVPLHC01XJwPp2bIPngH0iPOjrSpIj6r75aqu6A6YMSREkROMC0gFeDJmMUx5GWK8aLDQ8e+V5Ha68W8WxMedrmPVYaVp8DZ697GpJMztD5ohDYQ1tkMX5ayITNbGNCFVAdB04t89/1O/w1cDnyilFU='
            }       
        }

        var get_req = https.request(get_options, function(res) {
            console.log(res.statusCode);
            res.setEncoding('utf8');
            res.on('data', function (chunk) {
                var profile = JSON.parse(chunk);
                var name = profile.displayName;
                resolve(name);
            });
        });
        get_req.end();
    });
    return promise;
}

function send_user_reply(messages, replyToken) {
    var post_data = JSON.stringify({
        'replyToken': replyToken,
        'messages': messages
    });
    var post_len = Buffer.byteLength(post_data, "utf-8");
    console.log(post_data);
    
    var post_options = {
        host: 'api.line.me',
        port: '443',
        path: '/v2/bot/message/reply',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Content-Length': post_len,
            'Authorization': 'Bearer qUx2A3XbaFps24H+cP41TVPLHC01XJwPp2bIPngH0iPOjrSpIj6r75aqu6A6YMSREkROMC0gFeDJmMUx5GWK8aLDQ8e+V5Ha68W8WxMedrmPVYaVp8DZ697GpJMztD5ohDYQ1tkMX5ayITNbGNCFVAdB04t89/1O/w1cDnyilFU='
        }
    };

    var post_req = https.request(post_options, function(res) {
        console.log(res.statusCode);
        console.log('HEADERS: ' + JSON.stringify(res.headers));
        res.setEncoding('utf8');
        /*res.on('data', function (chunk) {
            console.log('BODY: ' + chunk);
        });*/
    });

    post_req.write(post_data);
    post_req.end();    
}

function get_word_from_game_type(gameType) {
    if (gameType == 0) {            return "統率";
    } else if (gameType == 1) {     return "武力";
    } else if (gameType == 2) {     return "智力";
    } else if (gameType == 3) {     return "政治";
    } else if (gameType == 4) {     return "魅力";
    } else {                        return "不合法";}
}

function get_attr_from_game_type(gameType) {
    if (gameType == 0) {            return "lead";
    } else if (gameType == 1) {     return "mighty";
    } else if (gameType == 2) {     return "intelligence";
    } else if (gameType == 3) {     return "politics";
    } else if (gameType == 4) {     return "charm";
    } else {                        return ""; }
}

function start_game(gameId, userName, replyToken) {
    var game_type = Math.floor((Math.random() * 5));
    
    var client = redis.createClient(6379, 'salembot.fluiz5.0001.apse1.cache.amazonaws.com');
    client.on('error', function(err) {
        console.log("redis error:" +err);     
    });
    client.hset(gameId + ".main", "type", game_type.toString());
    client.del(gameId + ".list");
    client.quit();
    console.log("put data in redis of key:" + gameId + " data: " + game_type.toString());
    
    var message = "使用者:[" + userName + "] 開啟了一場比" + get_word_from_game_type(game_type) + "的遊戲";
    var messages = [
        {'type': 'text', 'text': message}    
    ];
    send_user_reply(messages, replyToken);
}

function game_draw(gameId, userId, userName, replyToken) {
    var card_index = Math.floor((Math.random() * person.person.length));
    var game_card = person.person[card_index];
    var client = redis.createClient(6379, 'salembot.fluiz5.0001.apse1.cache.amazonaws.com');
    client.on('error', function(err) {
        console.log("redis error:" +err);     
    });
    client.hget(gameId + ".main", "type", function(error, result) {
        var messages = [];
        console.log(result);
        if (result == null) {
            var message = "遊戲尚未開局";
            messages = [
                {'type': 'text', 'text': message}
            ];
        } else {
            var data = {'name': userName, 'card': card_index};
            client.hset(gameId + ".list", userId, JSON.stringify(data));
            var message = "使用者:[" + userName + "] 抽取了一張卡片! 得到了:[" + game_card.name + "]";
            messages = [
                {'type': 'image', 'originalContentUrl': game_card.image, 'previewImageUrl': game_card.image},
                {'type': 'text', 'text': message}
            ];            
        }
        send_user_reply(messages, replyToken);
        client.quit();
    });
}

function judge_game(gameId, replyToken) {
    var client = redis.createClient(6379, 'salembot.fluiz5.0001.apse1.cache.amazonaws.com');
    var game_type = 0;
    client.on('error', function(err) {
        console.log("redis error:" +err);     
    });

    client.hget(gameId + ".main", "type", function(error, result) {
        console.log("get data from redis of key:" + gameId + " data:" + result);
        game_type = result;
    });
    client.hgetall(gameId + ".list", function(error, result) {
        console.log(result);
        var winner = undefined;
        var max = 0;
        if (result) {
            Object.keys(result).forEach(function(key) {
              var data = JSON.parse(result[key]);
                var name = data["name"];
                var card = person.person[data["card"]];
                var value = card[get_attr_from_game_type(game_type)];
                if (value > max) {
                    winner = data;
                    max = value;
                }
            });
        }
        
        var message = "本局沒有人參加";
        if (winner) {
            message = "本局的勝利者是[" + winner["name"] + "] 抽到的[" + person.person[winner["card"]].name + "]";
        }
        var messages = [
            {'type': 'text', 'text': message}
        ];
        send_user_reply(messages, replyToken);
    });
    client.del(gameId + ".list");
    client.del(gameId + ".main");
    client.quit();
}

exports.handler = (event, context, callback) => {
    console.log('aaa');
    /*Object.keys(event.headers).forEach(function(key) {
        console.log("m["+ key + "] = " + event.headers[key]);
    });*/
    console.log(JSON.stringify(event.body));
    var replyToken = event.body.events[0]['replyToken'];
    var userId = event.body.events[0]['source']['userId'];
    var type = event.body.events[0]['source']['type'];
    var message = event.body.events[0]['message'];
    var gameId = "";

    if (type == "group") {
        gameId = "GAME(G):" + event.body.events[0]['source']['groupId'];
    } else if (type == "room") {
        gameId = "GAME(R):" + event.body.events[0]['source']['roomId'];
    } else {
        gameId = "GAME(U):" + userId;
    }
    
    let promise = get_user_profile(userId);
    promise.then(function(name) {
        //console.log(name);
        if (message.type == "text" && message.text == "sango!") {
            start_game(gameId, name, replyToken);
        } else if (message.type == "text" && message.text == "draw!") {
            game_draw(gameId, userId, name, replyToken);
        } else if (message.type == "text" && message.text == "judge!") {
            judge_game(gameId, replyToken);
        }
    });
  
    callback(null, 'Hello from Lambda');
};
