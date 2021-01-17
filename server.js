import express from 'express';
import { getMinerInfo, handleBlockCommitInfo } from './rpc.js'
import heapdump from 'heapdump';
import redis from "redis"
import { promisify }  from "util"
import path from 'path';
let clientConfig = {};

if (process.env.NODE_ENV === "production") {
  clientConfig = { url: process.env.REDIS_URL };
} else {
  clientConfig = {
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: process.env.REDIS_PORT || "6379",
  };
}

const client = redis.createClient(clientConfig);

const redisGetAsync = promisify(client.get).bind(client);

client.on("error", function(error) {
  console.error(error);
});


const app = express()
const port = 8887

const root = ''
const data_root_path = `${root}${process.argv[3] || process.argv[2]}`
const use_txs = process.argv[2] === '-t'

const getRedisData = () => {
  const miningInfoPromise = redisGetAsync("mining_info");
  const minerInfoPromise = redisGetAsync("miner_info");
  return Promise.all([miningInfoPromise, minerInfoPromise])
  .then(([miningInfo, minerInfo]) => {
    return { miningInfo:miningInfo, minerInfo:minerInfo }
  })
}

const getBlockCommitsData = () => {
  const BlockCommitsPromise = redisGetAsync("block_commits_info");
  return Promise.all([BlockCommitsPromise])
  .then(([BlockCommitsInfo]) => {
    return { block_commits_info:BlockCommitsInfo}
  })
}

app.all("*", function (req, res, next) {
  res.header("Access-Control-Allow-Origin", req.headers.origin || '*');
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  res.header("Access-Control-Allow-Methods", "PUT,POST,GET,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Credentials", true);
  if (req.method == 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
})

async function update() {
  console.log("update")
  let result = await getMinerInfo()
  
  //console.log(JSON.stringify(result.mining_info))
  //console.log("in")
  //client.set("mining_info", JSON.stringify(result.mining_info))
  //client.set("miner_info", JSON.stringify(result.miner_info))
  let blockcommits = handleBlockCommitInfo(result.block_commits)
  console.log(blockcommits)
  client.set("block_commits_info", JSON.stringify(blockcommits))
  //console.log("in2")
  return "ok"
}

app.get('/update', (req, res) => {

  client.set("mining_info", "abc")
  res.json("ok")
})

app.get('/get', (req, res) => {
  client.set("mining_info", '{"name": "abc"}')
  getRedisData().then(
    (data) => {
      console.log(data)
      let resp = {miner_info: JSON.parse(data.minerInfo), mining_info: JSON.parse(data.miningInfo)}
      return res.send(resp)
    }
  )
})

app.get('/mining_info', (req, res) => {
  getRedisData().then(
    (data) => {
      let resp = {miner_info: JSON.parse(data.minerInfo), mining_info: JSON.parse(data.miningInfo)}
      return res.send(resp)
    }
  )
})

app.get('/block_info', (req, res) => {
  console.log(req.query.start)
  let start = req.query.start === undefined? 1 : req.query.start;
  let end = req.query.end === undefined? 999999 : req.query.end;
  let latest = req.query.latest === undefined? undefined: req.query.latest;
  getBlockCommitsData().then(
    (data) => {
      let resp = JSON.parse(data.block_commits_info)
      console.log(typeof(resp))
      if (latest) return res.send(resp.slice(-latest - 1))
      console.log("path:", path.resolve(''))

     // return res.sendFile(path.resolve('')+ '/index.html')
      return res.send(resp.slice(start - 1, end))
    }
  )
})

setInterval(function(){
  update();
}, 300000);



app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

update()

