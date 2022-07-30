const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const databasePath = path.join(__dirname, "twitterClone.db");

const app = express();

app.use(express.json());

let database = null;

const initializeDbAndServer = async () => {
  try {
    database = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    });

    app.listen(3000, () =>
      console.log("Server Running at http://localhost:3000/")
    );
  } catch (error) {
    console.log(`DB Error: ${error.message}`);
    process.exit(1);
  }
};

initializeDbAndServer();

function authenticateToken(request, response, next) {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, "SECRET_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        next();
      }
    });
  }
}

//API1 REGISTER

app.post("/register/", async (request, response) => {
  const { username, name, password, gender } = request.body;
  const hashedPassword = await bcrypt.hash(request.body.password, 10);
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    const createUserQuery = `
      INSERT INTO 
        user (username, password, name, gender) 
      VALUES 
        (
          '${username}', 
          '${hashedPassword}',
          '${name}',
          
          '${gender}'
          
        )`;
    if (password.length >= 6) {
      const dbResponse = await database.run(createUserQuery);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//API2 LOGIN

app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const dbUser = await database.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = {
        username: username,
      };
      const jwtToken = jwt.sign(payload, "SECRET_KEY");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API3 /user/tweets/feed/

app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const getAllTweets = `
    SELECT
     username,
    tweet,
    date_time AS dateTime
    FROM
    user 
    NATURAL JOIN tweet
    ORDER BY 
    username DESC
     LIMIT 4 ;`;
  const userFollows = await database.all(getAllTweets);
  response.send(userFollows);
});

//API4 /user/following/

app.get("/user/following/", authenticateToken, async (request, response) => {
  const getPeople = `
    SELECT 
    DISTINCT user.name 
    FROM user 
    INNER JOIN 
    follower ON user.user_id = follower.following_user_id;`;
  const people = await database.all(getPeople);
  response.send(people);
});

//API5 /user/followers/

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const getPeople = `
    SELECT 
    DISTINCT user.name 
    FROM user 
    INNER JOIN 
    follower ON user.user_id = follower.follower_user_id;`;
  const people = await database.all(getPeople);
  response.send(people);
});

//API6 /tweets/:tweetId/

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const getTweet = `
    SELECT
    tweet.tweet,
    COUNT(like.like_id) AS likes,
    COUNT(reply.reply_id) AS replies,
    tweet.date_time AS dateTime
    FROM
    tweet 
    INNER JOIN 
    reply ON tweet.user_id = reply.user_id 
    INNER JOIN 
    like ON reply.user_id = like.user_id 
    WHERE 
    tweet.tweet_id = '${tweetId}';`;
  const tweet = await database.get(getTweet);
  if (tweet === undefined) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    response.send(tweet);
  }
});

//API7 /tweets/:tweetId/likes/

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
  }
);

//API 9 /user/tweets/

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const getAllTweets = `
    SELECT
    tweet.tweet,
    COUNT(like.like_id) AS likes,
    COUNT(reply.reply_id) AS replies,
    tweet.date_time AS dateTime
    FROM 
    tweet 
    INNER JOIN 
    reply ON tweet.user_id = reply.user_id
    INNER JOIN 
    like ON reply.user_id = like.user_id
    INNER JOIN 
    user ON like.user_id = user.user_id;`;
  const allTweets = database.all(getAllTweets);
  response.send(allTweets);
});

//API 10 /user/tweets/

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const addTweet = `
    INSERT INTO 
    tweet (tweet)
    VALUES ('${tweet}');`;
  await database.run(addTweet);
  response.send("Created a Tweet");
});

//API 11 /tweets/:tweetId/

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const delTweet = `
    SELECT 
    * 
    FROM 
    tweet 
    WHERE 
    tweet_id = '${tweetId}';`;
    const tweetDeleted = await database.run(delTweet);
    if (tweetDeleted === undefined) {
      response.status(401);
      response.send("Invalid Request");
    } else {
      response.send("Tweet Removed");
    }
  }
);

module.exports = app;
