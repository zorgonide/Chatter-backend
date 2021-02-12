/* eslint-disable strict */
const WebSocket = require('ws');
var models = require('./server').models;

const ws = new WebSocket.Server({port: 8080});
let clients = [];

ws.on('connection', (ws) => {
  function login(email, pass) {
    models.User.login({email: email, password: pass}, (err, result) => {
      if (err) {
        ws.send(JSON.stringify({
          type: 'ERROR IN LOGIN FUNCTION',
          error: err,
        }));
      } else {
        // eslint-disable-next-line max-len
        models.User.findOne({where: {id: result.userId}, include: 'Profile'}, (err2, user) => {
          if (err2) {
            ws.send(JSON.stringify({
              type: 'ERROR IN FINDONE FUNCTION',
              error: err2,
            }));
          } else {
            const userObj = {
              id: user.id,
              email: user.email,
              ws: ws,
            };
            clients.push(userObj.email);
            console.log('Current Clients', clients);
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
        case 'LOGIN':
          login(parsed.data.email, parsed.data.password);
          break;
        case 'SEARCH':
          console.log('Searching for ', parsed.data);
          // eslint-disable-next-line max-len
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
        default:
          console.log('Nothing 2 C here');
      }
    }
  });
});
