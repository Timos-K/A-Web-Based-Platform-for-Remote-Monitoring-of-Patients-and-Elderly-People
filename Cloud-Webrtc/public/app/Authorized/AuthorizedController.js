/**
 * Created by timoskorres on 21/6/2017.
 */

var MainPage = angular.module('MainPage', ['ngRoute', 'ngResource', 'ngMaterial']);

MainPage.controller('ToolbarController', function ($mdToast, $timeout, $location, $scope, FriendsAndState, WebsocketService, AjaxServices) {
    if (token !== undefined) {
        $scope.username = my_name;
        //Hit the logout button
        $scope.logout = {
            clean: function () {
                localStorage.clear();
                token = undefined;
                ws.close();
                FriendsAndState.clean();
                $location.path('login');

            }
        };

        $scope.RequestsSent = {

            //These are about sending new requests
            target: null,
            sendRequest: function () {
                if ($scope.RequestsSent.target) {
                    AjaxServices.services.FriendRequest($scope.RequestsSent.target, function (result) {
                        // console.log(result);
                        $scope.RequestsSent.showResult(result);
                        //Update the view
                        $scope.RequestsSent.checkPending();
                    });
                }
            },
            showResult: function (string) {
                $mdToast.show(
                    $mdToast.simple()
                        .textContent(string)
                        .capsule(true)
                        .position('top left')
                )

            },

            //How to deal with requests already sent

            sent: [],
            checkPending: function () {
                AjaxServices.services.PendingRequests(function () {
                    $scope.RequestsSent.sent = Pending;
                })
            },
            cancel: function (name) {
                AjaxServices.services.CancelRequest(name, function (reply) {
                    if (reply.message === 'Ok') {
                        $scope.RequestsSent.sent = deleteFromList($scope.RequestsSent.sent, name);
                        Pending = $scope.RequestsSent.sent;
                        //  console.log($scope.RequestsSent.sent);
                    }
                    else {
                        $scope.RequestsSent.showResult(reply.message);

                    }
                })
            }


        };

        $scope.RequestsReceived = {
            Received: [],
            checkRequests: function () {
                AjaxServices.services.GetRequests(function () {
                    $scope.RequestsReceived.Received = requests;
                });
            },
            accept: function (name) {
                AjaxServices.services.requestReply(name, 'accept', function (reply) {
                    if (reply === 'Ok') {
                        //Update instantly your frriends
                        var message = {
                            type: 'update',
                            source: my_name,
                            token: token
                        };
                        ws.send(JSON.stringify(message));
                        $scope.RequestsReceived.Received = deleteFromList($scope.RequestsReceived.Received, name);
                        requests = $scope.RequestsReceived.Received;
                        // console.log(requests);
                        console.log("accepting " + name);
                    }

                })
            },
            reject: function (name) {
                console.log(name);
                AjaxServices.services.requestReply(name, 'reject', function (reply) {
                    if (reply === 'Ok') {
                        $scope.RequestsReceived.Received = deleteFromList($scope.RequestsReceived.Received, name);
                        requests = $scope.RequestsReceived.Received;
                        // console.log($scope.RequestsReceived.Received)
                    }
                    console.log("rejecting " + name);
                });
            }
        };

        //Check for Pending Requests


        //Check for Unanswered Friend Requests
        function deamon() {
            //console.log('Inside the great deamon');
            if(token !== undefined) {
                $scope.RequestsSent.checkPending();
                $scope.RequestsReceived.checkRequests();
                $timeout(deamon, 30000);
            }
        }

        deamon();
    }
});

MainPage.controller('AuthorizedController', function ($rootScope,$scope, $mdDialog, $timeout, $location, FriendsAndState, WebsocketService, AjaxServices) {
        if (token === undefined)
            $location.path('login');
        else {
            $scope.mainPageInfo = {
                Searching: '',
                Selected: '',
                friends: []
            };
            //Does take consideration into friends coming online
            $scope.init = function () {
                $scope.mainPageInfo.friends = FriendsAndState.getfriends();
            };
            $scope.SelectedUser = function (username) {
                $scope.mainPageInfo.Selected = username;
                ChatUser = username;
                $rootScope.$emit('NewMessage');
            };
            $scope.delete = function () {
                var status;
                console.log("About to delete " + $scope.mainPageInfo.Selected);
                var confirm = $mdDialog.confirm()
                    .clickOutsideToClose(true)
                    .title('Confirm')
                    .textContent('Are you sure you want to delete ' + $scope.mainPageInfo.Selected + ' ? ')
                    .ariaLabel()
                    .openFrom('#left')
                    .closeTo(angular.element(document.querySelector('#right')))
                    .ok('Yes I am ')
                    .cancel('No');

                $mdDialog.show(confirm).then(
                    function () {
                        //Delete users
                        AjaxServices.services.DeleteFriends($scope.mainPageInfo.Selected, function (result) {
                            console.log('Here we are');
                            for (var i = 0; i < $scope.mainPageInfo.friends.length; i++) {
                                console.log($scope.mainPageInfo.friends[i].username);
                                if ($scope.mainPageInfo.friends[i].username === $scope.mainPageInfo.Selected) {
                                    console.log('deleted ' + $scope.mainPageInfo.Selected);
                                    $scope.mainPageInfo.friends.splice(i, 1);
                                    break;
                                }
                            }
                        })
                    },
                    function () {
                        //Nothing happened, users cancelled his request
                    });

            };
            $scope.init();

            //Update the users state -> Async Function
            WebsocketService.refresh($scope, function () {
                $scope.mainPageInfo.friends = FriendsAndState.getfriends();
                $scope.$apply();
            });

            //This function goal is to update friends of a User real time
            function FriendsDeamon() {
                if(token !== undefined) {
                    var message = {
                        type: 'update',
                        source: my_name,
                        token: token
                    };
                    ws.send(JSON.stringify(message));
                    $timeout(FriendsDeamon, 15000);
                }
            }

            $timeout(FriendsDeamon,1000);
        }
    });

MainPage.controller('ChatController', function (AjaxServices,ChatServices,$timeout,$scope) {

    //Trial Chat Controller
    $scope.messages = {
        currentMessage: '',
        arrayofMessages: [],
        SelectedUser : '',
        addText: function (Someone) {
            console.log($scope.messages.currentMessage);
            $scope.messages.SelectedUser = Someone;
            if ($scope.messages.currentMessage !== '') {
                ChatServices.NewMessage(Someone,$scope.messages.currentMessage,'me',null);
                $scope.messages.arrayofMessages = ChatServices.SelectUser(Someone);
                //Send the message back to server
                var message = {
                    type: 'Chat',
                    target: Someone,
                    data: $scope.messages.currentMessage,
                    source: my_name
                };
                ws.send(JSON.stringify(message));
            }
            $scope.messages.currentMessage = '';
        } // We take the input of the user and add it to the specific user's array
    };


    ChatServices.refresh($scope, function () {
        $scope.messages.arrayofMessages = ChatServices.SelectUser(ChatUser);
        //Ask from Server if empty array
        if($scope.messages.arrayofMessages.length === 0){
            console.log('Going to ask Chat from: '+ ChatUser);
            AjaxServices.services.GetChat(ChatUser,function(result){
                var SavedMessages = result.data.message;
                for(var i=0;i<SavedMessages.length;i++){
                    ChatServices.NewMessage(ChatUser,SavedMessages[i].message,SavedMessages[i].message);
                }
                $scope.messages.arrayofMessages = ChatServices.SelectUser(ChatUser);
            });
        }
        if(!$scope.$$phase) {
            $scope.$apply();
        }
    });
});

MainPage.controller('Video-Controller', function ($rootScope, VideoServices, WebsocketService, $scope, $timeout) {
    function closeScreen() {
        $scope.videoInfo.HowVideoWasClosedFlag = false;
        $scope.videoInfo.status = 'Closed';  // Next time call is began do not show buttons by default
        $scope.videoInfo.Type = null;
        $scope.videoInfo.InCall = false;
        $scope.videoInfo.target = '';
    }


    $scope.videoInfo = {
        HowVideoWasClosedFlag: false,   // The only use of this Flag is to determine when Video Screen must be closed
        target: '',
        status: 'Closed',
        message: '',
        Type: null, //options are icnoming,outgoing
        InCall: false,
        closeScreen:function(){
            closeScreen();
        },
        call: function (username) {
            if($scope.videoInfo.status === 'Closed') { // Safety reason, user can't start calling while he is in a call
                $scope.videoInfo.Type = 'Outgoing';
                $scope.videoInfo.target = username; // Keep this info avaialable through calling proccess :)
                $scope.videoInfo.HowVideoWasClosedFlag = true;
                var message = {
                    type: 'video-start',
                    source: my_name,
                    target: username
                };
                WebsocketService.makeVideoCall(message);
                $scope.videoInfo.status = 'open';
                $scope.videoInfo.message = 'Calling ' + username;
            }
        },
        acceptCall: function () {
            $scope.videoInfo.message = '';
            var message = {
                type: 'video-response',
                target: VideoServices.getTarget(),
                source: my_name,
                answer: 'yes',
                sourceId: VideoServices.getMyid(),
                targetId: VideoServices.getTargetid()
            };
            console.log(message);
            $scope.videoInfo.message = '';
            ws.send(JSON.stringify(message));
            $scope.videoInfo.InCall = true;
        },
        rejectCall: function () {
            console.log(VideoServices.getTarget());
            var message = {
                type: 'busy',
                target: VideoServices.getTarget(),
                source: my_name,
                sourceId: VideoServices.getMyid(),
                targetId: VideoServices.getTargetid()
                // No User Id here we want to inform all users
            };
            ws.send(JSON.stringify(message));
            console.log('Target was set to null');
            VideoServices.ResetTarget();
            closeScreen();
        },
        cancelCall: function () {
            var message = {
                type: 'cancel',
                target: $scope.videoInfo.target,
                source: my_name
            };
            VideoServices.ResetTarget();
            closeScreen();
            ws.send(JSON.stringify(message));
        },
        hangUp: function () {

            console.log('Ok with Video closing');
            //Send message to other Peer to inform screen
            var message = {
                type: 'hang-up',
                target:VideoServices.getTarget(),
                sourceId: VideoServices.getMyid(),
                targetId: VideoServices.getTargetid()
            };
            ws.send(JSON.stringify(message));
            VideoServices.closeVideo();
            closeScreen();
        }
    };  // Information shown in Video View


    //Event handlers when new message arrives from Websockets

    $rootScope.$on('close-video', function () {
        console.log('The other peer closed');
        $scope.videoInfo.Type = 'Closed';
        $scope.videoInfo.InCall = false ;
        $scope.videoInfo.message = 'Call Ended ';
        VideoServices.closeVideo();
        $scope.$apply();
        $timeout(function(){
                if($scope.videoInfo.HowVideoWasClosedFlag === false)
                    closeScreen()
            }
            , 5000);

    });
    $rootScope.$on('busy', function () {
        $scope.videoInfo.message = 'Sorry '+ $scope.videoInfo.target + ' is busy!';
        $scope.videoInfo.Type = 'Closed';
        $scope.$apply();
        $scope.videoInfo.HowVideoWasClosedFlag = false;
        $timeout(function(){
            if($scope.videoInfo.HowVideoWasClosedFlag === false)
              closeScreen()
            }
        , 5000);
    });
    $rootScope.$on('cancel', function () {
        $scope.videoInfo.Total = false;
        $scope.videoInfo.message = VideoServices.getTarget() + ' has closed his phone';
        $scope.videoInfo.Type = 'Closed';
        $scope.$apply();
        console.log('Target was set to null because of cancelled call ');
        VideoServices.ResetTarget();
        $timeout(closeScreen, 3000);
    });
    $rootScope.$on('Offline', function () {
        console.log('Oops users seems to be disconnected');
        $scope.videoInfo.Type = 'Closed';
        $scope.videoInfo.InCall = false ;
        $scope.videoInfo.message = VideoServices.getTarget() + " was disconected";
        $scope.$apply();
        VideoServices.closeVideo();
        $timeout(function(){
                if($scope.videoInfo.HowVideoWasClosedFlag === false)
                    closeScreen()
            }
            , 5000);
    }); //User disconnected from Server


    WebsocketService.videostart($scope,function () {
            var peer = VideoServices.getPeer();
            if(!peer && $scope.videoInfo.target === '' ){                                  // Extra safety it has already beeing checked
                $scope.videoInfo.Type = 'Incoming';     // Only show accept-reject buttons if the user is receiving data
                $scope.videoInfo.status = 'open';
                $scope.videoInfo.message = VideoServices.getTarget() + " is calling";
                $scope.videoInfo.HowVideoWasClosedFlag = true;

            }
            else{ //User already is calling other user,inform the other user
                var message = {
                    type: 'busy',
                    sourceId: VideoServices.getMyid(),
                    targetId: VideoServices.getTargetid(),
                    target: VideoServices.getTarget(),
                    source: my_name
                };
                ws.send(JSON.stringify(message));
                VideoServices.ResetTarget();
            }

            $scope.$apply();
    });
    WebsocketService.videoresponse($scope, function () {
        //Video start here
        if (VideoServices.getPeer())
            alert("Can't start a new video during a call");
        else {
            VideoServices.setUsers($scope.videoInfo.target, my_name);
            //Let the service know the two User calling each other
            VideoServices.setPeer('Caller');
            $scope.videoInfo.InCall = true;
            $scope.videoInfo.message = '';
            $scope.$apply();
        }
    });
    WebsocketService.videoAnswer($scope, function () {
        VideoServices.SetAnswer();
    });
    WebsocketService.videoOffer($scope, function () {
        VideoServices.setPeer('Callee');
        $scope.videoInfo.Incall = true;

    });
    WebsocketService.Multiple($scope,function(){
       $scope.videoInfo.Type = 'Closed';
       if(MultpleUsersResult === 'yes')
        $scope.videoInfo.message = 'Answered on another Device';
        else
           $scope.videoInfo.message = 'Cancelled by another Device';
        $scope.$apply();
        VideoServices.ResetTarget();

        $timeout(closeScreen,4000);
    })


});


//Some global functions
function deleteFromList(list, element) {
    for (var i = 0; i < list.length; i++) {
        if (list[i] === element) {
            console.log('deleted ' + element);
            list.splice(i, 1);
            break;
        }
    }
    console.log(list);
    return list;
}
