import express from 'express';
import { getMinerInfo, handleBlockCommitInfo, latestSnapshot } from './rpc.js'
import heapdump from 'heapdump';
import redis from "redis"
import { promisify }  from "util"
import path from 'path';
import request from "request";


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
const port = 8889

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
  client.set("mining_info", JSON.stringify(result.mining_info))
  client.set("miner_info", JSON.stringify(result.miner_info))
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

app.get('/snapshot', (req, res) => {
  let r = latestSnapshot()
  res.send(r)
})

app.get('/snapshotIntegrate', (req, res) => {
  let requestList = ['http://47.242.239.96:8889/snapshot', 'https://blockchain.info/latestblock', 'https://blockchain.info/rawblock/']
  console.log(`requestSnapshot ${requestList[0]}`)
  let requestSnapshot = new Promise ((resolve, reject)=>{
    request.get(requestList[0], function (err, response, body) {
      if (err) {
          console.error(err)
      }
      else{
          console.log("requestSnapshotBody:" , body)
          resolve(JSON.parse(body))
      }
    })
  })
  console.log(`requestLatestBlock ${requestList[1]}`)
  let requestLatestBlock = new Promise ((resolve, reject)=>{

    request.get(requestList[1], function (err, response, body) {
      if (err) {
          console.error(err)
      }
      else{
          console.log("requestLatestBlock:", body)
          resolve(JSON.parse(body))
      }
    })
  })



  //blockheight
  //parent_block
  //parent_txoff


  /*
  let requestB = new Promise ((resolve, reject)=>{
    request.get(requestList[1], function (err, response, body) {
      if (err) {
          console.error(err)
          resolve("")
      }
      else{
          console.log(body)
          resolve(JSON.parse(body))
      }
    })
  })
  */




  return Promise.all([requestSnapshot, requestLatestBlock])
  .then(([snapshot, latestBlock]) => {
    //console.log(snapshot, latestBlock)
    //block_height
    //parent_block
    //parent_txoff
    console.log(snapshot[0].block_height, latestBlock.height)
    if (snapshot[0].block_height < latestBlock.height) 
      return res.send({status: 500, block_height: 0, parent_block: 0 , parent_txoff: 0})
    else{
      // latestBlock.hash
      // https://blockchain.info/rawblock/ + latestBlock.hash
      // snapshot.winning_block_txid
      return new Promise ((resolve, reject)=>{
        
        console.log("这里：", latestBlock.hash)
        console.log(snapshot.slice(-1)[0].winning_block_txid)
        console.log(`requesting ${requestList[2]+latestBlock.hash}`)

        var options = { method: 'POST',
          url: 'http://daemontech2:daemontech2@47.242.239.96:8332',
          headers: 
          { 'Postman-Token': '987df2f7-03e7-48f3-a0ab-a3c5ebbacf58',
            'cache-control': 'no-cache',
            'Content-Type': 'application/json' },
          body: 
          { id: 'stacks',
            jsonrpc: '2.0',
            method: 'getblock',
            params: [ '0000000000000000000b583b45dfdaf84ee18a9dbfb2cc51c044f605cb7c564a' ] },
          json: true };

        request(options, function (error, response, body) {
          if (error) {
              console.error(error)
          }
          else{
              let rawBlock = JSON.parse(body);
              let index = -1
              //console.log(rawBlock)
              for (let item in rawBlock.tx){
                
                if (rawBlock.tx[item].hash == snapshot.slice(-1)[0].winning_block_txid){
                    index = item
                    console.log("找到了：", item)
                }
              }
              console.log({ 
                              block_height: latestBlock.height, 
                              parent_block: latestBlock.height, 
                              parent_txoff: parseInt(index)
                            })
              if (index == -1){
                resolve(res.send({ 
                  status: 500,
                  block_height: latestBlock.height, 
                  parent_block: latestBlock.height, 
                  parent_txoff: -1
                }))
              }
              else{
                resolve(res.send({ 
                  status: 200,
                  block_height: latestBlock.height, 
                  parent_block: latestBlock.height, 
                  parent_txoff: parseInt(index)
                }))
              }
              
          }
        })
      })
    }
    
    
  })

})

/*
setInterval(function(){
  update();
}, 300000);
*/


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

//update()

