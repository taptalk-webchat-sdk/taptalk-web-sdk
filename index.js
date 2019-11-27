var define, CryptoJS;
var crypto = require('crypto');
var md5 = require('./lib/md5');

var authenticationHeader = {
    // "Content-Type": "application/json",
    "App-Key": "",
    "Authorization": "",
    "Device-Identifier": "",
    "Device-Model": navigator.appName,
    "Device-Platform": "web",
    "Server-Key": ""
};

var baseApiUrl = "";
var webSocket = null;
const DATE_NOW = new Date().valueOf();

const ROOM_TYPE = {
    PERSONAL: 1,
    GROUP: 2,
    CHANNEL: 3
}

const KEY_PASSWORD_ENCRYPTOR = "kHT0sVGIKKpnlJE5BNkINYtuf19u6+Kk811iMuWQ5tM";

var reader  = new FileReader();

const SOCKET_START_TYPING = "chat/startTyping";
const SOCKET_STOP_TYPING = "chat/stopTyping";
const EVENT_OPEN_ROOM = "chat/openRoom";
const SOCKET_CLOSE_ROOM = "chat/closeRoom";
const SOCKET_NEW_MESSAGE = "chat/sendMessage";
const SOCKET_UPDATE_MESSAGE = "chat/updateMessage";
const SOCKET_DELETE_MESSAGE = "chat/deleteMessage";
const SOCKET_OPEN_MESSAGE = "chat/openMessage";
const SOCKET_AUTHENTICATION = "user/authentication";
const SOCKET_USER_ONLINE_STATUS = "user/status";
const SOCKET_USER_UPDATED = "user/updated";
const USER = this.taptalk.getTaptalkActiveUser();       
const CHAT_MESSAGE_TYPE_TEXT = 1001;
const CHAT_MESSAGE_TYPE_IMAGE = 1002;
const CHAT_MESSAGE_TYPE_VIDEO = 1003;
const CHAT_MESSAGE_TYPE_FILE = 1004;
const CHAT_MESSAGE_TYPE_LOCATION = 1005;
const CHAT_MESSAGE_TYPE_CONTACT = 1006;
const CHAT_MESSAGE_TYPE_STICKER = 1007;
const CHAT_MESSAGE_TYPE_PRODUCT = 2001;
const CHAT_MESSAGE_TYPE_CATEORY = 2002;
const CHAT_MESSAGE_TYPE_PAYMENT_CONFIRMATION = 2004;
const CHAT_MESSAGE_TYPE_SYSTEM_MESSAGE = 9001;
const CHAT_MESSAGE_TYPE_UNREAD_MESSAGE_IDENTIFIER = 9002;

const MESSAGE_ID = "0";
const MESSAGE_MODEL = {
    messageID: MESSAGE_ID,
    localID: guid(),
    type: 0,
    body: "",
    data: "",
    filterID: "",
    isHidden: false,
    quote: {
        title: "",
        content: "",
        imageURL: "",
        fileID: "",
        fileType: ""
    },
    replyTo: {
        userID: "0",
        xcUserID: "",
        fullname: "",
        messageID: "0",
        localID: "",
        messageType: 0
    },
    forwardFrom: {
        userID: "0",
        xcUserID: "",
        fullname: "",
        messageID: "0",
        localID: ""
    },
    room: {
        roomID: "",
        name: "",
        type: 0, // 1 is personal; 2 is group
        imageURL: {
            thumbnail: "",
            fullsize: ""
        },
        color: "",
        deleted: 0,
        isDeleted: false
    },
    user: null,
    recipientID: "0",
    action: "",
    target: {
        targetType: "",
        targetID: "0",
        targetXCID: "",
        targetName: ""
    },
    isSending: null,
    isDelivered: null,
    isRead: null,
    isDeleted: null,
    created: DATE_NOW,
    updated: DATE_NOW
}

function doXMLHTTPRequest(method, header, url, data, isMultipart= false) {
    return new Promise(function (resolve, reject) {
        let xhr = new XMLHttpRequest();

        xhr.open(method, url, true);

        for(let headerVal in header) {
            xhr.setRequestHeader(headerVal, header[headerVal]);        
        }

        xhr.send(method === 'POST' && isMultipart ? data : JSON.stringify(data));
        
        xhr.onload = function() {
            if (xhr.status === 200) {
                resolve(JSON.parse(xhr.response));
            } else {
                reject({
                    status: xhr.status,
                    statusText: xhr.statusText
                });
            }
        };

        xhr.onerror = function () {
            reject({
            status: xhr.status,
            statusText: xhr.statusText
            });
        };
    });
}

function getLocalStorageObject(storage) {
    return JSON.parse(localStorage.getItem(storage));
}

function generateHeaderQuerystring() {
    let keys = {
        "content_type": authenticationHeader["Content-Type"],
        "app_key": authenticationHeader["App-Key"],
        "authorization": `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`,
        "device_identifier": authenticationHeader["Device-Identifier"],
        "device_model": authenticationHeader["Device-Model"],
        "device_platform": "web",
    }

    var s = [];
    for (var i in keys) {
        s.push(i + "=" + encodeURIComponent(keys[i]));
    }

    return s.join("&");
}

function setUserDataStorage(response) {
    let data = response;
    data.logout = false;
    return localStorage.setItem('TapTalk.UserData', JSON.stringify(response));
}


function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
        .toString(16)
        .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

function isFileAllowed(fileType, file) {
    let fileTypeAllowed = false;
    
    for (let type in fileType) {
        if(fileType[type] === file) {
            fileTypeAllowed = true;
        }
    }

    return fileTypeAllowed;
}

exports.taptalk = {
    init : (appID, appSecret, serverID, serverSecret, baseUrlApi, deviceID) => {
        authenticationHeader["App-Key"] = btoa(`${appID}:${appSecret}`);
        authenticationHeader["Server-Key"] = btoa(`${serverID}:${serverSecret}`);
        authenticationHeader["Device-Identifier"] = deviceID;
        baseApiUrl = baseUrlApi;
    },

    authenticateWithAuthTicket : (authTicket, connectOnSuccess, callback) => {
        let url = `${baseApiUrl}/v1/auth/access_token/request`;
        let _this = this;

        setTimeout(() => {
            authenticationHeader["Authorization"] = `Bearer ${authTicket}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    if(response.error.code === "") {
                        setUserDataStorage(response.data);

                        callback(response.data, null)
                        
                        connectOnSuccess && _this.testAccessToken();
                    }else {
                        callback(null, response.error)
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }, 300);
    },

    testAccessToken : (callback) => {
        authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;
        
        let url = `${baseApiUrl}/connect?check=1`;
        let _this = this;

        doXMLHTTPRequest('GET', authenticationHeader, url, "")
            .then(function (response) {
                if(response.error.code === "") {
                    _this.connect();
                }else {
                    if(response.error.code === "40104") {
                        _this.taptalk.refreshAccessToken(() => _this.taptalk.testAccessToken(null))
                    }else {
                        callback(null, response.error);
                    }
                } 
            })
            .catch(function (err) {
                console.error('Augh, there was an error!', err);
            });
    },

    connect : (callback) => {
        if (window["WebSocket"]) {
            authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;
            var url = `wss://${baseApiUrl.replace('https://', '')}/connect?${generateHeaderQuerystring()}`;
            webSocket = new WebSocket(url);

            webSocket.onopen = function () {
                callback('Connected to websocket', null);   
            }
            webSocket.onclose = function () {
                callback('Disconnecting from websocket', null);
            };
            webSocket.onerror = function () {
                callback(null, 'Error while connecting to web socket');
            }
            webSocket.onmessage = function (evt) {
				let response;
				reader.onload = function () {
					var messages = this.result.split('\n');
					response = JSON.parse(messages);
					callback(response, null);
				};
				reader.readAsText(evt.data);
            };
        } else {
            alert("Your browser does not support WebSockets.");
            callback(null, 'cannot connect to websocket');
        }
    },

    disconnect : () => {
        return webSocket ? webSocket.close() : false;
    },

    isConnected : () => {
        return webSocket ? webSocket.readyState === 1 : false;
    },

    refreshAccessToken : (callback) => {
        if(this.taptalk.isAuthenticated()) {
            let url = `${baseApiUrl}/v1/auth/access_token/refresh`;

            setTimeout(() => {
                authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').refreshToken}`;

                doXMLHTTPRequest('POST', authenticationHeader, url, "")
                    .then(function (response) {
                        if(response.error.code === "") {
                            setUserDataStorage(response.data);

                            callback();
                        }else {
                            if(response.error.code === "40104") {
                                localStorage.removeItem('TapTalk.UserData');
                                console.log('Please request new access token');
                            }else {
                                console.log(response.error);
                            }
                        } 
                    })
                    .catch(function (err) {
                        console.error('there was an error!', err);
                    });
            }, 300);
        }else {
            return;
        }
    },

    isAuthenticated : () => {
        return (
            getLocalStorageObject("TapTalk.UserData") ? 
                getLocalStorageObject("TapTalk.UserData").accessToken ? true : false
                :
                false
        )
    },

    logoutAndClearAllTapTalkData : (callback) => {
        let url = `${baseApiUrl}/v1/client/logout`;
        let _this = this;

        if(this.taptalk.isAuthenticated() ) {
            authenticationHeader["Authorization"] = `Bearer ${getLocalStorageObject('TapTalk.UserData').accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    if(response.error.code === "") {
                        localStorage.removeItem('TapTalk.UserData');
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.taptalk.logoutAndClearAllTapTalkData(null))
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    getProjectConfigs : () => {
        return getLocalStorageObject('TapTalk.ProjectConfigs');
    },

    refreshProjectConfigs : (callback) => {
        let url = `${baseApiUrl}/v1/client/project_configs`;

        authenticationHeader["Authorization"] = "";

        doXMLHTTPRequest('POST', authenticationHeader, url, "")
            .then(function (response) {
                if(response.error.code === "") {
                    let authData = response.data;

                    localStorage.setItem('TapTalk.ProjectConfigs', JSON.stringify(authData));
                }else {
                    console.log(response.error);
                }
            })
            .catch(function (err) {
                console.error('there was an error!', err);
                callback(null, err);
            });
    },

    getTaptalkActiveUser : () => {
        let userDataStorage = getLocalStorageObject('TapTalk.UserData');
        return !userDataStorage ? null : userDataStorage.user;
    },

    refreshActiveUser : (callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: userData.user.userID})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', JSON.stringify(userData))

                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.taptalk.refreshActiveUser(null))
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    }
}

exports.tapCoreRoomListManager = {
    getUpdatedRoomList : (callback) => {
          let url = `${baseApiUrl}/v1/chat/message/room_list_and_unread`;
          let _this = this;
          let user = this.taptalk.getTaptalkActiveUser().userID;

          if(this.taptalk.isAuthenticated()) {
              let userData = getLocalStorageObject('TapTalk.UserData');
              authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

              doXMLHTTPRequest('POST', authenticationHeader, url, "")
              .then(function (response) {
                if(response.error.code === "") {
                    let roomList = [];
                    let allLatestMessage = response.data.messages;
                    let data = response.data.messages;

                    for(let i in response.data.messages) {							
                        let isRoomExist = roomList.findIndex(value => value.room.roomID === data[i].room.roomID);

                        if(isRoomExist === -1) {
                            let latestRoomListIndex = roomList.length;

                            roomList.push(data[i]);

                            roomList[latestRoomListIndex]["unreadCount"] = 0;

                            roomList[latestRoomListIndex].body = decryptKey(data[i].body, data[i].localID);

                            if(roomList[latestRoomListIndex].data !== "") {
                                roomList[latestRoomListIndex].data = JSON.parse(decryptKey(data[i].data, data[i].localID));
                            }

                            //set unread count value from private chat if it wasn't from me
                            // if(!roomList[latestRoomListIndex].isRead && (user === roomList[latestRoomListIndex].recipientID)) {
                            // 	roomList[latestRoomListIndex]["unreadCount"] = 1;
                            // }

                            //set unread count value from private chat if it was from me
                            if(!roomList[latestRoomListIndex].isRead && (user !== roomList[latestRoomListIndex].recipientID)) {
                                roomList[latestRoomListIndex]["unreadCount"] = 0;
                            }

                            //set unread count value from group chat if the latest chat was from other member
                            if(!roomList[latestRoomListIndex].isRead && (roomList[latestRoomListIndex].recipientID === "0")) {
                                roomList[latestRoomListIndex]["unreadCount"] = 1;
                            }

                            //set unread count value to from group chat if the latest chat was from me
                            if(!roomList[latestRoomListIndex].isRead && (roomList[latestRoomListIndex].recipientID === "0") && (user === roomList[latestRoomListIndex].user.userID)) {
                                roomList[latestRoomListIndex]["unreadCount"] = 0;
                            }

                            // roomList.push(data[i]);
                        }else {
                            let dataUnreadBefore = roomList[isRoomExist]["unreadCount"];

                            if((!roomList[isRoomExist].isRead) && (roomList[isRoomExist].user.userID !== user)) {
                                roomList[isRoomExist]["unreadCount"] = dataUnreadBefore + 1;
                            }
                        }
                    }

                    callback({allLatestMessageGroup : roomList, allLatestMesaasdsage: allLatestMessage}, null)
                }else {
                          if(response.error.code === "40104") {
                              _this.taptalk.refreshAccessToken(() => _this.tapCoreRoomListManager.getUpdatedRoomList(null))
                          }else {
                              callback(null, response.error);
                          }
                      }
                  })
                  .catch(function (err) {
                      console.error('there was an error!', err);
                      callback(null, err);
                  });
           }
     },

      getPersonalChatRoomById : (recipient, callback) => {
          let userID = getLocalStorageObject('TapTalk.UserData').user.userID;
          let roomID = `${userID < recipient.id ? userID+"-"+recipient.id : recipient.id+"-"+userID}`;
          const RoomType = ROOM_TYPE.personal;
          let personalChatRoom = {
              roomID: roomID,
              RoomName: recipient.name,
              RoomType: RoomType,
              RecipientImage: recipient.avatar,
              roomColor: ""
          };

          return callback(personalChatRoom);
      },

      getUserByIdFromApi : (userId, callback) => {
          let url = `${baseApiUrl}/v1/client/user/get_by_id`;
          let _this = this;

          if(this.taptalk.isAuthenticated()) {
              let userData = getLocalStorageObject('TapTalk.UserData');
              authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

              doXMLHTTPRequest('POST', authenticationHeader, url, {id: userId})
                  .then(function (response) {
                      if(response.error.code === "") {
                          callback(response.data, null);
                      }else {
                          if(response.error.code === "40104") {
                              _this.taptalk.refreshAccessToken(() => _this.tapCoreRoomListManager.getUserByIdFromApi(userId, null))
                          }else {
                              callback(null, response.error);
                          }
                      }
                  })
                  .catch(function (err) {
                      console.error('there was an error!', err);
                      callback(null, err);
                  });
          }
      }
}

exports.tapCoreChatRoomManager = {
    sendStartTypingEmit : (roomID) => {
        let emitData = {
            eventName: SOCKET_START_TYPING,
            data: {
                roomID: roomID,
                user: USER
            }
        };

        webSocket.send(JSON.stringify(emitData));
    },

    sendStopTypingEmit : (roomID) => {
        let emitData = {
            eventName: SOCKET_STOP_TYPING,
            data: {
                roomID: roomID,
                user: USER
            }
        };

        webSocket.send(JSON.stringify(emitData));
    },

    createGroupChatRoom : (groupName, participantList, callback) => {
        let url = `${baseApiUrl}/v1/client/room/create`;
        let _this = this;
        let data = {
            name: groupName,
            type: 2,
            userIDs: participantList
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.createGroupChatRoom(groupName, participantList, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    createGroupChatRoomWithPicture : (groupName, participantList, imageUri, callback) => {
        let _this = this;
        this.tapCoreChatRoomManager.createGroupChatRoom(groupName, participantList, function(response, error) {
            if(response) {
                let url = `${baseApiUrl}/v1/client/room/photo/upload`;
                let uploadData = new FormData();

                uploadData.append("roomID", response.room.roomID);
                uploadData.append("file", imageUri);
                
                if(_this.taptalk.isAuthenticated()) {
                    let userData = getLocalStorageObject('TapTalk.UserData');
                    authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

                    doXMLHTTPRequest('POST', authenticationHeader, url, uploadData, true)
                        .then(function (response) {
                            if(response.error.code === "") {
                                callback(response.data, null);
                            }else {
                                if(response.error.code === "40104") {
                                    _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.createGroupChatRoom(groupName, participantList, null));
                                }else {
                                    callback(null, response.error);
                                }
                            }
                        })
                        .catch(function (err) {
                            console.error('there was an error!', err);
                            callback(null, err);
                        });
                }
            }
        })
    },

    updateGroupPicture : (groupId, imageUri, callback) => {
        let _this = this;
        let url = `${baseApiUrl}/v1/client/room/photo/upload`;
        let uploadData = new FormData();

        uploadData.append("roomID", groupId);
        uploadData.append("file", imageUri);
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, uploadData, true)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.updateGroupPicture(groupId, imageUri, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    getGroupChatRoom : (groupId, callback) => {
        let _this = this;
        let url = `${baseApiUrl}/v1/client/room/get`;
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: groupId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.getGroupChatRoom(groupId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    updateGroupChatRoomDetails : (groupId, groupName, callback) => {
        let url = `${baseApiUrl}/v1/client/room/update`;
        let _this = this;
        let data = {
            roomID: groupId,
            name: groupName
        };

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.updateGroupChatRoomDetails(groupId, groupName, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    deleteGroupChatRoom : (roomId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/delete`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            let checksum = md5(`${roomId}:${ROOM_TYPE.GROUP}:${userData.user.userID}:${userData.accessTokenExpiry}`);
            let data = {
                roomID: roomId,
                checksum: checksum
            };
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.deleteGroupChatRoom(groupChatModel, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    leaveGroupChatRoom : (groupId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/leave`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {roomID: groupId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.leaveGroupChatRoom(groupId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    addGroupChatMembers : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/participants/add`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.addGroupChatMembers(groupId, userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    removeGroupChatMembers(groupId, userId, callback) {
        let url = `${baseApiUrl}/v1/client/room/participants/remove`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.removeGroupChatMembers(groupId, userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    }, 

    promoteGroupAdmins : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/admins/promote`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.promoteGroupAdmins(groupId, userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    demoteGroupAdmins : (groupId, userId, callback) => {
        let url = `${baseApiUrl}/v1/client/room/admins/demote`;
        let _this = this;
        let data = {
            roomID: groupId,
            userIDs: userId
        }

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreChatRoomManager.demoteGroupAdmins(groupId, userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    }
}

exports.tapCoreMessageManager  = {
    constructTapTalkMessageModel : (messageBody, room, messageType, messageData) => {
        let roomSplit = room.split("-");
        let recipient = roomSplit[0] === USER.userID ? roomSplit[0] : roomSplit[1];
        MESSAGE_MODEL["user"] = USER;
        MESSAGE_MODEL["type"] = messageType;
        MESSAGE_MODEL["body"] = messageBody;
        MESSAGE_MODEL["room"]["roomID"] = room;
        MESSAGE_MODEL["room"]["type"] = room.includes('g') ? 2 : 1;
        MESSAGE_MODEL["recipientID"] = recipient;
        MESSAGE_MODEL["data"] = messageData;
        this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);
    },

    constructTapTalkMessageModelWithQuote : (messageBody, room, messageType, messageData, quotedMessage) => {
        let roomSplit = room.split("-");
        let recipient = roomSplit[0] === USER.userID ? roomSplit[0] : roomSplit[1];
        MESSAGE_MODEL["user"] = USER;
        MESSAGE_MODEL["type"] = messageType;
        MESSAGE_MODEL["body"] = messageBody;
        MESSAGE_MODEL["room"]["roomID"] = room;
        MESSAGE_MODEL["room"]["type"] = room.includes('g') ? 2 : 1;
        MESSAGE_MODEL["recipientID"] = recipient;
        MESSAGE_MODEL["data"] = messageData;
        MESSAGE_MODEL["quote"]["title"] = quotedMessage.title;
        MESSAGE_MODEL["quote"]["content"] = quotedMessage.content;
        MESSAGE_MODEL["quote"]["imageURL"] = quotedMessage.imageURL;
        MESSAGE_MODEL["quote"]["fileID"] = quotedMessage.fileID;
        MESSAGE_MODEL["quote"]["fileType"] = quotedMessage.fileType;
        this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);
    },

    constructMessageStatus : (isSending, isDelivered, isRead, isDeleted) => {
        MESSAGE_MODEL["isSending"] = isSending;
        MESSAGE_MODEL["isDelivered"] = isDelivered;
        MESSAGE_MODEL["isRead"] = isRead;
        MESSAGE_MODEL["isDeleted"] = isDeleted;
    },

    sendTextMessage : (messageBody, room, callback) => {
        if(this.taptalk.isAuthenticated()) {
            this.constructTapTalkMessageModel(encryptKey(messageBody, "12345678901234567890123456789012"), room, CHAT_MESSAGE_TYPE_TEXT, "");

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: MESSAGE_MODEL
			};
            
            webSocket.send(JSON.stringify(emitData));
        }
    },

    sendTextMessageQuotedMessage : (messageBody, room, quotedMessage, callback) => {
        if(this.taptalk.isAuthenticated()) {
            this.constructTapTalkMessageModelWithQuote(encryptKey(messageBody, guid()), room, CHAT_MESSAGE_TYPE_TEXT, "", quotedMessage);

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: MESSAGE_MODEL
            };
            
            webSocket.send(JSON.stringify(emitData));
        }
    },

    sendLocationMessage : (latitude, longitude, address, room, callback) => {
        if(this.taptalk.isAuthenticated()) {
            let data =  encryptKey(`
                     {
                         address = "${address}";
                         latitude = "${latitude}";
                         longitude = "${longitude}";
                     }
            `, guid())

            this.tapCoreMessageManager.constructTapTalkMessageModel("", room, CHAT_MESSAGE_TYPE_LOCATION, data);
            this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: MESSAGE_MODEL
            };
            
            webSocket.send(JSON.stringify(emitData));
        }
    },

    sendLocationMessageQuotedMessage : (latitude, longitude, address, room, quotedMessage, callback) => {
        if(this.taptalk.isAuthenticated()) {
            let data =  encryptKey(`
                     {
                         address = "${address}";
                         latitude = "${latitude}";
                         longitude = "${longitude}";
                     }
            `, guid())
            
            this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote("", room, CHAT_MESSAGE_TYPE_LOCATION, data, quotedMessage);
            this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

            let emitData = {
                eventName: SOCKET_NEW_MESSAGE,
                data: MESSAGE_MODEL
            };
            
            webSocket.send(JSON.stringify(emitData));
        }
    },

    uploadChatFile : (data, callback) => {
        let url = `${baseApiUrl}/v1/chat/file/upload`;
        let uploadData = new FormData();
        let _this = this;
        let fileType = data.file.type.split("/")[0];

        uploadData.append("roomID", data.room);
        uploadData.append("file", data.file);
        uploadData.append("caption", data.caption);
        uploadData.append("fileType", fileType !== "image" || "video" ? "file" : fileType);
        
        if(_this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, uploadData, true)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreMessageManager.uploadChatFile(data, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    sendImageMessage : (file, caption, room, callback) => {
        let uploadData = {
            file: file,
            caption: caption,
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModel("", room, _this.CHAT_MESSAGE_TYPE_IMAGE, messageData);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: _this.SOCKET_NEW_MESSAGE,
                    data: _this.MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    sendImageMessageQuotedMessage : (file, caption, room, quotedMessage, callback) => {
        let uploadData = {
            file: file,
            caption: caption,
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote("", room, CHAT_MESSAGE_TYPE_IMAGE, messageData, quotedMessage);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    sendVideoMessage : (videoUri, caption, room, callback) => {
        let uploadData = {
            file: videoUri,
            caption: caption,
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModel("", room, CHAT_MESSAGE_TYPE_VIDEO, messageData);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    sendVideoMessageQuotedMessage : (videoUri, caption, room, quotedMessage, callback) => {
        let uploadData = {
            file: videoUri,
            caption: caption,
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote("", room, CHAT_MESSAGE_TYPE_VIDEO, messageData, quotedMessage);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    sendFileMessage : (file, room, callback) => {
        let uploadData = {
            file: file,
            caption: "",
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModel("", room, CHAT_MESSAGE_TYPE_FILE, messageData);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    sendFileMessageQuotedMessage : (file, room, quotedMessage, callback) => {
        let uploadData = {
            file: file,
            caption: "",
            room: room
        };

        let _this = this;

        this.tapCoreMessageManager.uploadChatFile(uploadData, function(response, error) {
            if(response) {
                let messageData = encryptKey(`{
                    {
                        fileID = "${response.fileID}";
                    }
                }`, guid());

                _this.tapCoreMessageManager.constructTapTalkMessageModelWithQuote("", room, CHAT_MESSAGE_TYPE_FILE, messageData, quotedMessage);
                _this.tapCoreMessageManager.constructMessageStatus(true, false, false, false);

                let emitData = {
                    eventName: SOCKET_NEW_MESSAGE,
                    data: MESSAGE_MODEL
                };
                
                webSocket.send(JSON.stringify(emitData));
            }else {
                console.log(error);
            }
        });
    },

    getOlderMessagesBeforeTimestamp : (roomId, maxCreatedTimestamp, numberOfItems, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/list_by_room/before`;
        let _this = this;
        let data = {
            roomID: roomId,
            maxCreated: maxCreatedTimestamp,
            limit: numberOfItems
        };

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreMessageManager.getOlderMessagesBeforeTimestamp(roomId, maxCreatedTimestamp, numberOfItems, callback));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    getNewerMessagesAfterTimestamp : (roomId, minCreatedTimestamp, lastUpdateTimestamp, callback) => {
        let url = `${baseApiUrl}/v1/chat/message/list_by_room/after`;
        let _this = this;
        let data = {
            roomID: roomId,
            minCreated: minCreatedTimestamp,
            lastUpdated: lastUpdateTimestamp
        };

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, data)
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreMessageManager.getNewerMessagesAfterTimestamp(roomId, minCreatedTimestamp, lastUpdateTimestamp, callback));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    markMessageAsRead : (message) => {
        let url = `${baseApiUrl}/v1/chat/message/feedback/read`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {messageIDs: message})
                .then(function (response) {
                    if(response.error.code === "40104") {
                        _this.taptalk.refreshAccessToken(() => _this.tapCoreMessageManager.markMessageAsRead(message));
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                });
        }
    }
}

exports.tapCoreContactManager  = {
    getAllUserContacts : (callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, "")
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.getAllUserContacts(null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    getUserDataWithUserID : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_id`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {id: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        userData.user = response.data.user;
                        localStorage.setItem('TapTalk.UserData', JSON.stringify(userData))

                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.getUserDataWithUserID(userId, null))
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    getUserDataWithXCUserID : (xcUserId, callback) => {
        let url = `${baseApiUrl}/v1/client/user/get_by_xcuserid`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {xcUserID: xcUserId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.getUserDataWithXCUserID(null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    addToTapTalkContactsWithUserID : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/add`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {userID: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.addToTapTalkContactsWithUserID(userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    addToTapTalkContactsWithPhoneNumber : (phoneNumber, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/add_by_phones`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {phones: phoneNumber})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.addToTapTalkContactsWithPhoneNumber(phoneNumber, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    },

    removeFromTapTalkContacts : (userId, callback) => {
        let url = `${baseApiUrl}/v1/client/contact/remove`;
        let _this = this;

        if(this.taptalk.isAuthenticated()) {
            let userData = getLocalStorageObject('TapTalk.UserData');
            authenticationHeader["Authorization"] = `Bearer ${userData.accessToken}`;

            doXMLHTTPRequest('POST', authenticationHeader, url, {userID: userId})
                .then(function (response) {
                    if(response.error.code === "") {
                        callback(response.data, null);
                    }else {
                        if(response.error.code === "40104") {
                            _this.taptalk.refreshAccessToken(() => _this.tapCoreContactManager.removeFromTapTalkContacts(userId, null));
                        }else {
                            callback(null, response.error);
                        }
                    }
                })
                .catch(function (err) {
                    console.error('there was an error!', err);
                    callback(null, err);
                });
        }
    }
}

//   //to encrypt and decrypt
var PKCS7Encoder = {};

PKCS7Encoder.decode = function(text) {
    var pad = text[text.length - 1];

    if (pad < 1 || pad > 16) {
        pad = 0;
    }

    return text.slice(0, text.length - pad);
};

PKCS7Encoder.encode = function(text) {
    var blockSize = 16;
    var textLength = text.length;
    var amountToPad = blockSize - (textLength % blockSize);

    var result = new Buffer(amountToPad);
    result.fill(amountToPad);

    return Buffer.concat([text, result]);
};

function encrypt(text, key) {
    var encoded = PKCS7Encoder.encode(new Buffer(text));
    key = crypto.createHash('sha256').update(key).digest();
    var iv = new Buffer(16);
    iv.fill(0);
    var cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    cipher.setAutoPadding(false);
    var cipheredMsg = Buffer.concat([cipher.update(encoded), cipher.final()]);
    return cipheredMsg.toString('base64');
};

function decrypt(text, key) {
    key = crypto.createHash('sha256').update(key).digest();
    var iv = new Buffer(16);
    iv.fill(0);
    var decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    var deciphered = Buffer.concat([decipher.update(text, 'base64'), decipher.final()]);
    deciphered = PKCS7Encoder.decode(deciphered);
    return deciphered.toString();
};
//   //to encrypt and decrypt

//   //Encryption Flow
//   // 1. Obtain message length, local ID length
//   // 2. Get local ID index (message length modulo by local ID length)
//   // 3. Generate random number from 1-9
//   // 4. Obtain salt character from local ID string with character position of local ID index
//   // 5. Insert salt character to encrypted message to the position index (index is calculated using this formula (((encrypted message length + random number) * random number) % encrypted message length)))
//   // 6. Add random number to the first index of the encrypted message with salt

  function encryptKey(text, localID) {
      if(text === null || localID === null) {
          return null; 
      }

      let substringLocalID = localID.substring(8, 8+16);
      let reverseSubstringLocalID = "";
      let appendedString = "";
      let charIndex = substringLocalID.length;
      
      while(charIndex > 0) {
          charIndex--;
          appendedString = null;
          appendedString =  substringLocalID.substring(charIndex, charIndex+1);
          reverseSubstringLocalID = reverseSubstringLocalID + appendedString;
      }

      //password is generated based on 16 first characters of KEY_PASSWORD_ENCRYPTOR + reversedSubstringLocalID
      let substringKeyPassword = KEY_PASSWORD_ENCRYPTOR.substring(0, 16);
      let password = substringKeyPassword + reverseSubstringLocalID;

      let stringLength = text.length;
      let localIDLength = localID.length;
      let localIDIndex = stringLength % localIDLength;

      let saltString = localID.substring(localIDIndex, localIDIndex+1);
      let encryptedString = encrypt(text, password);

      let randomNumber = Math.floor(Math.random() * 8) + 1;
      let encryptedStringLength = encryptedString.length;

      let saltCharIndexPosition = (((encryptedStringLength + randomNumber) * randomNumber) % encryptedStringLength);
      let encryptedStringWithSalt = encryptedString;

      let appendString = (str, index, value) => {
          return str.substr(0, index) + value + str.substr(index);
      }
      encryptedStringWithSalt = appendString(encryptedStringWithSalt, saltCharIndexPosition, saltString);
      encryptedStringWithSalt = appendString(encryptedStringWithSalt, 0, randomNumber.toString());

      return encryptedStringWithSalt;
  }

  function decryptKey(encryptedString, localID) {
      if(encryptedString === null || localID === null) {
          return null; 
      }

      let substringLocalID = localID.substring(8, 8+16);
      let reverseSubstringLocalID = "";
      let appendedString;
      let charIndex = substringLocalID.length;

      while(charIndex > 0) {
          charIndex--;
          appendedString = null;
          appendedString =  substringLocalID.substring(charIndex, charIndex+1);
          reverseSubstringLocalID = reverseSubstringLocalID + appendedString;
      }

      //password is generated based on 16 first characters of KEY_PASSWORD_ENCRYPTOR + reversedSubstringLocalID
      let substringKeyPassword = KEY_PASSWORD_ENCRYPTOR.substring(0, 16);
      let password = substringKeyPassword + reverseSubstringLocalID;
      
      let encryptedStringWithSalt = encryptedString;
      let encryptedStringLength = encryptedStringWithSalt.length - 2; //2 to remove random number & salt character

      let randomNumberString = encryptedStringWithSalt.substring(0, 1);
      let randomNumber = parseInt(randomNumberString);

      let saltCharIndexPosition = (((encryptedStringLength + randomNumber) * randomNumber) % encryptedStringLength);
      let encryptedStringModified = encryptedStringWithSalt.substr(1);

      if(saltCharIndexPosition < encryptedStringModified.length) {
          encryptedStringModified = encryptedStringModified.substring(0, saltCharIndexPosition) + '' + encryptedStringModified.substring(saltCharIndexPosition + 1);
      }else {
          return null;
      }

      let decryptedString = decrypt(encryptedStringModified, password);

      return decryptedString
  }

