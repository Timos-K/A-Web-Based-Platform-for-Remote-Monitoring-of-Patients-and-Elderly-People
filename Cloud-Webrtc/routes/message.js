/**
 * Created by timos on 19/7/2017.
 */


var express = require('express');
var router = express.Router();
var passport = require('passport');
var message = require('../models/messages');
var conversation = require('../models/conversation');



router.get('/',passport.authenticate('bearer', {session: false}),function(req,res,next){
        var UserFound = req.user;
        var target =req.query.target;
        var Array = [target,UserFound.username];
        try {
            conversation.findOne({Participants: {$all: Array}}, function (err, result1) {
                if (err)
                    console.log(err);
                else {
                    var ConvId = result1.ConversationId;
                    message.findOne({ConvesrationId: ConvId}, function (err, result2) {
                        if (err)
                            console.log(err);
                        else {
                            var Result = [];
                            var messages = result2.message;
                            for(var i=0;i<messages.length;i++){
                                var data = messages[i].data;
                                var direction ;
                                if(messages[i].from !== UserFound.username)
                                    direction=target;
                                else
                                    direction = 'me';
                                var msg = {
                                    message:data,
                                    direction: direction
                                };
                                Result.push(msg);
                            }
                            res.send({message: Result});
                        }
                    })
                }
            })
        }
        catch(e){
            console.log(e);
            res.send({message:'Please try again'});
        }

});


module.exports = router;