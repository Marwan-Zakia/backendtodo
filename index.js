"use strict";
require("dotenv").config();
const express = require("express");
const app = express();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const SECRET = process.env.SECRET || "secret";
const PORT = process.env.PORT || 5000;
const { Sequelize, DataTypes } = require("sequelize");
const basicAuth = require('../backendtodo/middleware/basic');
const bearerAuth = require('../backendtodo/middleware/bearer');
const permissions = require('../backendtodo/middleware/acl.js')
const cors = require("cors");
const Collection = require("./collection");
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const DATABASE_URI =
  process.env.NODE_ENV === "test" ? "sqlite:memory:" : process.env.DATABASE_URL;

let sequelizeOptions =
  process.env.NODE_ENV === "production"
    ? {
        dialectOptions: {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        },
      }
    : {};

const sequelize = new Sequelize(DATABASE_URI, sequelizeOptions);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const Todo = (sequelize, DataTypes) =>
  sequelize.define("todo", {
    assignee: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    difficulty: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    completed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  });

const Users = (sequelize, DataTypes) => {
  const userModel = sequelize.define("users", {
    username: {
      type: DataTypes.STRING,
      unique: true,
      allowNull: false,
      required: true,
    },
    password: { type: DataTypes.STRING, allowNull: false, required: true },
    role: {
      type: DataTypes.ENUM("admin", "editor", "writer"),
      allowNull: true,
      defaultValue: "admin",
    },
    token: {
      type: DataTypes.VIRTUAL,
      get() {
        return jwt.sign({ username: this.username }, SECRET);
      },
      set(tokenObj) {
        let token = jwt.sign(tokenObj, SECRET);
        return token;
      },
    },
    capabilities: {
      type: DataTypes.VIRTUAL,
      get() {
        const acl = {
          admin: ["read", "write", "delete", "update"],
          editor: ["read", "update"],
          writer: ["create"],
        };
        return acl[this.role];
      },
    },
  
  });

  userModel.beforeCreate(async (user) => {
    let hashedPass = await bcrypt.hash(user.password, 10);
    user.password = hashedPass;
  });
  userModel.BasicAuth = async function (username, password) {
    const user = await this.findOne({ where: { username } });
    const valid = await bcrypt.compare(password, user.password);
    if (valid) {
      return user;
    }
    throw new Error("Invalid User");
  };

  userModel.authToken = async function (token) {
    try {
      const parsedToken = jwt.verify(token, SECRET);
      const user = this.findOne({ where: { username: parsedToken.username } });
      if (user) {
        return user;
      }
      throw new Error("User Not Found");
    } catch (e) {
      throw new Error(e.message);
    }
  };

  return userModel;
};

const users = Users(sequelize, DataTypes);
console.log(users)
const newUserCollection = new Collection(users);
console.log(newUserCollection)
const newTodo = Todo(sequelize, DataTypes);
const todoCollection = new Collection(newTodo);

app.get("/api/todos", async (req, res) => {
  const id = parseInt(req.params.id);
  let todoItem = await todoCollection.read(id);
  res.status(200).json(todoItem);
});

app.post("/api/todos", async (req, res) => {
  let newCusInfo = req.body;
  let todoItem = await todoCollection.create(newCusInfo);
  res.status(201).json(todoItem);
});

app.put("/api/todos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const obj = req.body;
  let todoItem = await todoCollection.update(id, obj);

  res.status(201).json(todoItem);
});

app.delete("/api/todos/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  let todoItem = await todoCollection.delete(id);
  res.status(204).json(todoItem);
});

app.post("/signup", async (req, res, next) => {
  console.log(users);
  try {
    let userRecord = await users.create(req.body);
    const output = {
      user: userRecord,
      token: userRecord.token,
    };
    res.status(201).json(output);
  } catch (error) {
    next(error.message);
  }
});

app.post("/sign-in", basicAuth, async (req, res, next) => {
  res.status(200).json(req.user);
});
app.get("/users", bearerAuth, permissions("delete"), async (req, res, next) => {
  const userRecords = await users.findAll({});
  const list = userRecords.map((user) => user.username);
  res.status(200).json(list);
});

sequelize
  .sync()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch(console.error);

module.exports = { Users: users, newUserCollection };
