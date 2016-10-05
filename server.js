var app      =     require("express")();
var mongo    =     require('mongodb');
var mongoose =     require('mongoose');
var http     =     require('http').Server(app);
var io       =     require("socket.io")(http);
var cookieParser = require('cookie-parser');
var guid      =    require('guid');
var async =        require('async');

/* Creating connection.*/

mongoose.connect('mongodb://127.0.0.1/realTimeData', function (err, database) {
  if(err)
  {
    console.log("database not connected");
  }
  else {
    console.log("database connected");  
      
  }
});

app.use(cookieParser());

app.get("/", function(req, res) {
  res.sendFile(__dirname + '/home.html');
})

app.get("/bconId", function(req, res) {
  var chars = 'acdefhiklmnoqrstuvwxyz0123456789'.split('');
  var bcon = '';
  for(var i=0; i<4; i++){
    var x = Math.floor(Math.random() * chars.length);
    bcon += chars[x];
  }
  console.log("random bcon id:::", bcon);
  var createJson = {
      "click_cnt" : 0,
      "cookie_val": "",
      "bcon_id" : bcon,
      "bcon_count": 0
    }
    click_count.create(createJson, function(err, data) {
      if(!err) {
        //console.log("allocate connection to clients:::", data);
        console.log('Bcon id created and save successfully');
        res.send(bcon);
        
      }
    })
})

app.get("/index",function(req,res){
  //var deviceId = req.params.id;
  var getCookie = req.cookies.cookieName;
  var bcon = req.cookies.bcon;
  if (getCookie === undefined && bcon === undefined)
  {
    async.waterfall([
      function(callback) {
        findAllClients( function(err, data) {
          if(!err) {
            callback(null, data);
          }
          else {
            callback(err);
          }
        })
    }, 
    function(data, callback) {
      var counter = 0;
      if(data.length > 0) {
        for(var i in data) {
          counter++;
          console.log("counter and data length is::", counter, data.length)
          if(data[i].bcon_count === 4) {
            if(counter === data.length) {
              console.log("counter and data length is::", counter, data.length)
              var fullFlag = true;
              callback(null, fullFlag); 
            }
            else{
              continue;
            }
          }
          else {
            var randomNumber = guid.raw();
            var bconArrId = data[i].bcon_id;

            if(data[i].cookie_val === "") {
              res.cookie('cookieName',randomNumber);
              res.cookie('bcon',bconArrId);
              data[i].bcon_count++;
              var updtBconCount = {
                  "bcon_id" : bconArrId
                }

              click_count.update(updtBconCount, {$set: {"bcon_count":data[i].bcon_count, "cookie_val":randomNumber}}, function(err, updtData) {
                if(!err){
                  console.log("update successful is::", updtData);
                  callback(null);
                }
                else {
                  console.log("failed to update existing bcon id", err);
                  callback(err);
                }
              })
              break;
            }
            else {
              res.cookie('cookieName',randomNumber);
              res.cookie('bcon',bconArrId);
              data[i].bcon_count++
              var createJson = {
                "click_cnt" : 0,
                "cookie_val": randomNumber,
                "bcon_id" : bconArrId,
                "bcon_count": data[i].bcon_count
              }
              var updtBconCount = {
                  "bcon_id" : bconArrId
                }

              click_count.update(updtBconCount, {$set: {"bcon_count":data[i].bcon_count}}, {multi:true}, function(err, updtData) {
                if(!err){
                  console.log("update successful is::", updtData);
                }
              })
              click_count.create(createJson, function(err, data) {
                if(!err) {
                  console.log("allocate connection to clients:::", data);
                  console.log('cookie created successfully');
                  callback(null);                 
                }
                else {
                  console.log("error to create new client", err);
                  callback(err);
                }
              })
              break;
            }
          }
        }
      }
      else {
       var fullFlag = true;
       callback(null, fullFlag);
      }
    }

    ],

    function (err, results) {
      console.log("check in final callback");
            if(err){
                res.status(400).json({apiStatus: "Failure", msg: "Error while to set cookie"});
            }
            else if(results === true) {
              res.json({ massege: 'Group is full with existing deviceID' });
            }
            else{
                res.sendFile(__dirname + '/index.html');
            }

        }
    )
    
  } 
  else
  {
    // yes, cookie was already present 
    console.log('getCookie exists', getCookie);
    res.sendFile(__dirname + '/index.html');
  } 
    //res.sendFile(__dirname + '/index.html');
});

/*  This is auto initiated event when Client connects to Your Machien.  */

io.set('authorization', function (handshakeData, callback) {
    if (handshakeData.domain) {
        callback('Cross-domain connections are not allowed');
    } else {
        callback(null, true);
    }
});


var allClients = [];
io.on('connection',function(socket){ 
    
    socket.on('status added',function(status, cookie, reqBcon){
      add_ClickStatus(status, cookie, reqBcon, function(res){
        if(res){
          //console.log("counter res is::", res);
          findAllClients(function(err, data) {
            //console.log("all clients",data);
            if(!err) {
              io.emit('refresh feed',data);
            }
          })
          
            // sending to all clients except sender
            //socket.broadcast.emit('refresh feed',res);
            // sending to individual socketid
            //socket.broadcast.to(socket.id).emit('refresh feed',res);
            // sending to sender-client only
            //socket.emit('refresh feed',res);
            // sending to all clients, include sender
            
        } else {
          console.log("error in clicks");
            io.emit('error');
        }
      });
    });

    findAllClients(function(err, data) {
      //console.log("all clients",data);
      if(!err) {
        io.emit('refresh feed',data);
      }
    })
    
    
    socket.on('disconnect', function() {
        var i = allClients.indexOf(socket);
        allClients.splice(i, 1);
    });
});


  var clicksSchema = new mongoose.Schema({
    "click_cnt" : Number,
    "cookie_val": String,
    "bcon_id" : String,
    "bcon_count": Number

  })
 
  var click_count = mongoose.model('ClickDev', clicksSchema);
  
var add_ClickStatus = function(status, cookie, bcon, callback){
  status = status + 1;
      click_count.find(cookie, function(err, data) {
        if(!err) {
          if(data.length>0) {
            console.log(" found clicks", data);
            var updtJson = {
              click_cnt: status
            }
            console.log("browser cookie is::", cookie, updtJson);
            click_count.update(cookie, updtJson, function(err, data) {
              if(!err) {
                console.log("update clicks:::", data);
                var updateClicks = {
                  "click_cnt" : status,
                  "cookie_val": cookie.cookie_val,
                  "bcon_id" : bcon
                }
                return callback(updateClicks);
              }
            })
          }
          else{
            console.log("empty object  ",data);
            var createJson = {
              "click_cnt" : status,
              "cookie_val": cookie.cookie_val,
              "bcon_id" : bcon
            }
            console.log("createJson", createJson, cookie);
            click_count.create(createJson, function(err, data) {
              if(!err) {
                console.log("create clicks:::", data);
                return callback(null, data);
              }
            })
          }
        }
        else {
          callback(err)
        }
      })
}

var findAllClients = function(callback) {
  click_count.find(function(err, data) {
    //console.log("retrive data ::", data);
    if(!err) {
      return callback(null, data);
    }
    else {
      return callback(err);
    }
  })
}



 

http.listen(3000,function(){
    console.log("Listening on 3000");
});
