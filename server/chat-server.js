/* eslint-disable max-len */
/* eslint-disable strict */
const WebSocket = require('ws');
var models = require('./server').models;

const ws = new WebSocket.Server({port: 8080});
let clients = [];

ws.on('connection', (ws) => {
  function getInitialThreads(userId) {
    models.Thread.find({where: {}}, (err, threads) => {
      if (!err && threads) {
        ws.send(JSON.stringify({
          type: 'INITIAL_THREADS',
          data: threads,
        }));
      }
    });
  }
  function login(email, pass) {
    models.User.login({email: email, password: pass}, (err, result) => {
      if (err) {
        ws.send(JSON.stringify({
          type: 'ERROR IN LOGIN FUNCTION',
          error: err,
        }));
      } else {
        models.User.findOne({where: {id: result.userId}, include: 'Profile'}, (err2, user) => {
          if (err2) {
            ws.send(JSON.stringify({
              type: 'ERROR IN FINDONE FUNCTION',
              error: err2,
            }));
          } else {
            ws.uid = user.id + new Date().getTime().toString();
            const userObj = {
              id: user.id,
              email: user.email,
              ws: ws,
            };
            clients.push(userObj);
            // console.log('Current Clients', clients);
            // clients.map(u => console.log('Current Clients', u.email));
            console.log(clients.map(c => c.email));
            getInitialThreads(user.id);
            ws.send(JSON.stringify({
              type: 'LOGGEDIN',
              data: {
                session: result,
                user: user,
              },
            }));
          }
        });
      }
    });
  }

  ws.on('close', (req) => {
    console.log('Req closed', req);
    let clientIndex = -1;
    clients.map((c, i) => {
      if (c.ws._closeCode === req) {
        clientIndex = i;
      }
    });
    if (clientIndex > -1) {
      clients.splice(clientIndex, 1);
    }
  });

  ws.on('message', (message) => {
    console.log('message: ', JSON.parse(message));
    let parsed = JSON.parse(message);
    if (parsed) {
      // add break in switch statements
      switch (parsed.type) {
        case 'SIGNUP':
          models.User.create(parsed.data, (error, user) => {
            if (error) {
              ws.send(JSON.stringify({
                type: 'ERROR IN CREATING PROFILE',
                error: error,
              }));
            } else {
              models.Profile.create({
                userId: user.id,
                name: parsed.data.name,
                email: parsed.data.email,
              }, (profileError, profile) => {
                console.log('Profile created', profile);
                ws.send(JSON.stringify({
                  type: 'CREATED PROFILE',
                  data: profile,
                }));
              });
            }
          });
          break;
        case 'CONNECT_WITH_TOKEN':
          models.User.findById(parsed.data.userId, (err2, user) => {
            if (!err2 && user) {
              ws.uid = user.id + new Date().getTime().toString();
              const userObj = {
                id: user.id,
                email: user.email,
                ws: ws,
              };
              clients.push(userObj);
              console.log(clients.map(c => c.email));
              getInitialThreads(user.id);
            }
          });
          break;
        case 'LOGIN':
          login(parsed.data.email, parsed.data.password);
          break;
        case 'SEARCH':
          console.log('Searching for ', parsed.data);
          models.User.find({where: {email: {like: parsed.data}}}, (err2, users) => {
            if (!err2 && users) {
              ws.send(JSON.stringify({
                type: 'GOT_USERS',
                data: {
                  users: users,
                },
              }));
            }
          });
          break;
        case 'FIND_THREAD':
          models.Thread.findOne({where: {
            and: [
              {users: {like: parsed.data[0]}},
              {users: {like: parsed.data[1]}},
            ],
          }}, (err, thread) => {
            if (!err && thread) {
              ws.send(JSON.stringify({
                type: 'ADD_THREAD',
                data: thread,
              }));
            } else {
              models.Thread.create({
                lastUpdated: new Date(),
                users: parsed.data,
              }, (err2, thread) => {
                if (!err2 && thread) {
                  clients.filter(u => thread.users.indexOf(u.id.toString()) > -1).map(client => {
                    client.ws.send(JSON.stringify({
                      type: 'ADD_THREAD',
                      data: thread,
                    }));
                  });
                }
              });
            }
          });
          break;
        // case 'THREAD_LOAD':

        //   break;
        default:
          console.log('Nothing 2 C here');
      }
    }
  });
});
