'use strict';
 require('../index');
const base64 = require('base-64');
// here we have to create a model 
const  usersModel  = require('../index');
module.exports = async (req, res, next) => {

  const encodedHeaders = req.headers.authorization.split(' ')[1];
  const [username, password] = base64.decode(encodedHeaders).split(':');
  console.log(username, password);
  console.log(usersModel)
  usersModel.BasicAuth(username, password).then(validUser => {
    req.user = validUser;
    next();
  }).catch(err => {  console.log(err),next('Invalid 1Login') })

}

