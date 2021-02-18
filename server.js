import express from 'express';
import { getMinerInfo, handleBlockCommitInfo, latestSnapshot, getblockchaininfo, latest3Snapshot, latest3StagingBlock, getLatestStage, getMiningStatus, setMiningStatus } from './rpc.js'
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

const getMiningInfoFromRedis = () => {
  const miningInfoPromise = redisGetAsync("mining_info");
  return Promise.all([miningInfoPromise])
  .then(([miningInfo]) => {
    return miningInfo
  })
}

const getMinerInfoFromRedis = () => {
  const minerInfoPromise = redisGetAsync("miner_info");
  return Promise.all([minerInfoPromise])
  .then(([minerInfo]) => {
    return minerInfo 
  })
}

const getBlockInfoFromRedis = () => {
  const blockInfoPromise = redisGetAsync("block_info");
  return Promise.all([blockInfoPromise])
  .then(([blockInfo]) => {
    return blockInfo
  })
}



async function update() {
  console.log("update")
  let result = await getMinerInfo()
  //console.log(result)
  //console.log(JSON.stringify(result.mining_info))

  client.set("mining_info", JSON.stringify(result.mining_info))
  client.set("miner_info", JSON.stringify(result.miner_info))
  let blockcommits = handleBlockCommitInfo(result.block_commits)
  //console.log(blockcommits)
  client.set("block_info", JSON.stringify(blockcommits))
  //console.log("in2")
  return "ok"
}

app.get('/update', (req, res) => {
  update()
  res.json("ok")
})


app.get('/mining_info', (req, res) => {
  let latest = req.query.latest === undefined? undefined: req.query.latest;
  getMiningInfoFromRedis().then(
    (data) => {
      let resp = JSON.parse(data)
      if (latest) return res.send(resp.slice(0, latest))
      return res.send(resp)
    }
  )
})

app.get('/miner_info', (req, res) => {
  let latest = req.query.latest === undefined? undefined: req.query.latest;
  let page = req.query.page === undefined? undefined: req.query.page;
  let size = req.query.size === undefined? undefined: req.query.size;
  getMinerInfoFromRedis().then(
    (data) => {
      let resp = JSON.parse(data)
      if (latest) 
          return res.send({'data': resp.slice(-latest - 1), 'total': resp.length});
      if (page && size) 
          return res.send({'data':resp.slice(size*(page-1), size*page), 'total':resp.length}); 
      return res.send({'data': resp, 'total': resp.length})
    }
  )
})

app.get('/miner_info_rt', async (req, res) => {
  let result = await getMinerInfo({startblock:req.query.startblock, endblock:req.query.endblock})
  //console.log(result.miner_info)
  res.send(result.miner_info)
})

app.get('/block_info', (req, res) => {
  console.log(req.query.start)
  let start = req.query.start === undefined? 1 : req.query.start;
  let end = req.query.end === undefined? 999999 : req.query.end;
  let latest = req.query.latest === undefined? undefined: req.query.latest;
  getBlockInfoFromRedis().then(
    (data) => {
      let resp = JSON.parse(data)
      if (latest) 
          return res.send(resp.slice(-latest - 1))
      return res.send(resp.slice(start - 1, end))
    }
  )
})


app.get('/snapshot', (req, res) => {
  let r = latestSnapshot()
  res.send(r)
})

app.get('/snapshot3', (req, res) => {
  let r = latest3Snapshot()
  res.send(r)
})

app.get('/stagedb', (req, res) => {
  let r = latest3StagingBlock()
  res.send(r)
})


app.get('/snapshotIntegrate', (req, res) => {
  let requestList = ['http://47.242.239.96:8889/snapshot']
  
  let requestSnapshot = new Promise ((resolve, reject)=>{
    console.log("requesting SnapshotBody =============================================")
    request.get(requestList[0], function (err, response, body) {
      if (err) {
          console.error(err)
      }
      else{
        try {
          console.log("requestSnapshotBody--------------------------:" , body)
          let result = JSON.parse(body)
          
          //console.log(result[0].block_height, result[0].winning_block_txid)
          resolve(result)
        }
        catch(error){
          resolve([{block_height: 0, winning_block_txid: 0}])
        }
      }
    })
  })

  let requestLatestBlock = new Promise ((resolve, reject)=>{
    console.log("requesting LatestBlock =============================================")
    var options = {
      'method': 'POST',
      'url': 'http://daemontech2:daemontech2@47.242.239.96:8332',
      'headers': {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ "id": "stacks", "jsonrpc": "2.0", "method": "getblockchaininfo", "params": [] })
    };

    request(options, function (error, response, body) {
      if (error) {
        return { status: 500 };
      }
      else{
        try {
          console.log("requestLatestBlockBody------------------------------:" , body)
          const info = JSON.parse(body)
          //console.log('height:', info.result.blocks);
          //console.log('bestblockhash:', info.result.bestblockhash);
          //console.log("requestLatestBlock:" , {height: info.result.blocks, bestblockhash: info.result.bestblockhash})
          resolve({height: info.result.blocks, bestblockhash: info.result.bestblockhash})  
        }
        catch (error){
          resolve({height: 999999999, bestblockhash: 0})  
        }
      }
    });

  });


  return Promise.all([requestSnapshot, requestLatestBlock])
  .then(([snapshot, latestBlock]) => {
    //console.log(snapshot, latestBlock)
    //block_height
    //parent_block
    //parent_txoff
    //console.log(snapshot[0].block_height, latestBlock.height)
    if (snapshot[0].block_height < latestBlock.height) 
      return res.send({status: 500, block_height: 0, parent_block: 0 , parent_txoff: 0, msg: "snapshot is lower than latestblockheight"})
    else{
      // latestBlock.hash
      // https://blockchain.info/rawblock/ + latestBlock.hash
      // snapshot.winning_block_txid
      
      return new Promise ((resolve, reject)=>{
        
        //console.log("Hash在这里：", latestBlock.bestblockhash)
        let winning_block_txid = snapshot.slice(-1)[0].winning_block_txid
        let winning_block_hash = snapshot.slice(-1)[0].burn_header_hash
        let winning_block_height = snapshot.slice(-1)[0].block_height
        //console.log("winning_block_txid:", winning_block_txid)

        var options = { 
          "method": 'POST',
          "url": 'http://daemontech2:daemontech2@47.242.239.96:8332',
          "body": JSON.stringify({ "id": 'stacks', "jsonrpc": '2.0', "method": 'getblock', "params": [ winning_block_hash ] }),
          'headers': {
            'Content-Type': 'application/json'
          },
        };

        console.log("requesting RawBlock ===================================================")
        request(options, function (error, response, body) {
          if (error) {
              console.error(error)
          }
          else{
              //console.log(body)
              //console.log("no error")
              let index = -1
              try {
              
                let rawBlock = JSON.parse(body);
                
                //console.log(rawBlock)
                
                for (let item in rawBlock.result.tx){
                  //console.log(item)
                  //console.log(item, rawBlock.result.tx[item].hash, snapshot.slice(-1)[0].winning_block_txid)     
                  
                  if (rawBlock.result.tx[item] == winning_block_txid){
                      index = item
                      console.log("找到了：", item)
                  }
                  
                }
              }
              catch (error){
                console.log("error when parsing, keep going")
                index = -1
              }
              
              
              console.log({ 
                              block_height: latestBlock.height, 
                              parent_block: winning_block_height, 
                              parent_txoff: parseInt(index)
                            })
              if (index === -1){
                resolve(res.send({ 
                  status: 500,
                  block_height: latestBlock.height, 
                  parent_block: winning_block_height, 
                  parent_txoff: -1
                }))
              }
              else{
                resolve(res.send({ 
                  status: 200,
                  block_height: latestBlock.height, 
                  parent_block: winning_block_height, 
                  parent_txoff: parseInt(index)
                }))
              }     
          }
        })
      })
    } 
  })
})


setInterval(function(){
  update();
}, 60000);


app.get('/getLatestStage', (req, res) => {
  let r = getLatestStage()
  res.send(r)
})

app.get('/isStagedbSynced', (req, res) => {
  let localStage = getLatestStage()
  let remoteStagePromise = new Promise ((resolve, reject)=>{
    console.log("requesting getLatestStage =============================================")
    request.get("http://47.242.239.96:8889/getLatestStage", function (err, response, body) {
      if (err) {
          console.error(err)
      }
      else{
        try {
          console.log("requesting getLatestStage body--------------------------:" , body)
          let result = JSON.parse(body)
          //console.log(result)
          //console.log(result[0].block_height, result[0].winning_block_txid)
          resolve(result)
        }
        catch(error){
          resolve({ height: 0 })
        }
      }
    })
  })

  return Promise.all([remoteStagePromise]).then(([remoteStage])=>{
    console.log(localStage, remoteStage)
    console.log(localStage.height, remoteStage.height)
    if (localStage === undefined || remoteStage === undefined || localStage.height === undefined || remoteStage.height === undefined)
      return res.send({status: 500, canMine: false})
    if (localStage.height === remoteStage.height)
      return res.send({status: 200, canMine: true})
    else
      return res.send({status: 200, canMine: false})
  })
  
})




app.get('/blockchaininfo', (req, res) => {
  let r = getblockchaininfo()
  res.send(r)
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

//update()

