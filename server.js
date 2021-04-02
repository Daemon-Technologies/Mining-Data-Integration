import express from 'express';
import { getMinerInfo, handleBlockCommitInfo, latestSnapshot, getblockchaininfo, latest3Snapshot, latest3StagingBlock, getLatestStage, getMiningStatus, setMiningStatus } from './rpc.js'
import { packMiningMonitorData } from "./mining_monitor_rpc.js"
import heapdump from 'heapdump';
import redis from "redis"
import { promisify }  from "util"
import path from 'path';
import request from "request";
import {computeRR} from './utils.js'

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

const getMinerInfo1000FromRedis = () => {
  const miningInfoPromise = redisGetAsync("miner_info1000");
  return Promise.all([miningInfoPromise])
  .then(([miningInfo]) => {
    return miningInfo
  })
}

const getMinerInfo100FromRedis = () => {
  const miningInfoPromise = redisGetAsync("miner_info100");
  return Promise.all([miningInfoPromise])
  .then(([miningInfo]) => {
    return miningInfo
  })
}

const getBtcHeightFromRedis = () => {
  const miningInfoPromise = redisGetAsync("btc_height");
  return Promise.all([miningInfoPromise])
  .then(([miningInfo]) => {
    return miningInfo
  })
}

async function update() {
  console.log("update")
  let result = await getMinerInfo()
  //console.log(result)
  //console.log(JSON.stringify(result.mining_info))
  //console.log("in")
  let btc = 50000
  let stx = 1.2
  let gas = 56000
  for (let item in result.miner_info){
    let rr = computeRR({btcPrice: btc, stxPrice: stx, gas: gas, minerData: result.miner_info[item]});
    //console.log(rr)
    result.miner_info[item].RR = rr.toFixed(3);
  }
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

async function updateRecent(){
  console.log("udpate recent")
  let block_info = await getBlockInfoFromRedis()
  let block_info_JSON = JSON.parse(block_info)
  let current_block_height = block_info_JSON.length;

  let btc = 50000
  let stx = 1.2
  let gas = 56000

  let result1000 = await getMinerInfo({startblock:current_block_height-1000, endblock:current_block_height})
  for (let item in result1000.miner_info){
    let rr = computeRR({btcPrice: btc, stxPrice: stx, gas: gas, minerData: result1000.miner_info[item]});
    //console.log(rr)
    result1000.miner_info[item].RR = rr.toFixed(3);
  }

  let result100 = await getMinerInfo({startblock:current_block_height-100, endblock:current_block_height})
  for (let item in result100.miner_info){
    let rr = computeRR({btcPrice: btc, stxPrice: stx, gas: gas, minerData: result100.miner_info[item]});
    //console.log(rr)
    result100.miner_info[item].RR = rr.toFixed(3);
  }

  client.set("miner_info1000", JSON.stringify(result1000.miner_info))
  client.set("miner_info100", JSON.stringify(result100.miner_info))
}

async function updateBitcoinInfo() {
  console.log("update Bitcoin Info")
  let url = "https://chain.api.btc.com/v3/block/latest";
  request.get(url, function (err, response, body) {
    if (err) {
        console.error(err)
    }
    else{
      try {
        let result = JSON.parse(body)
        //console.log(result)
        //console.log(result[0].block_height, result[0].winning_block_txid)
        //console.log(result)
        client.set("btc_height", result.data.height)
        return { height: result.data.height }
      }
      catch(error){
        return { height: 0 }
      }
    }
  })
}


app.get('/miner_info_rt', async (req, res) => {
  let result = await getMinerInfo({startblock:req.query.startblock, endblock:req.query.endblock})
  let btc = 50000
  let stx = 1.2
  let gas = 56000
  if (req.query.btc!=undefined && req.query.stx!=undefined){
    btc = req.query.btc
    stx = req.query.stx
  }
  if (req.query.gas!=undefined){
    gas = req.query.gas
  }
  
  for (let item in result.miner_info){
    let rr = computeRR({btcPrice: btc, stxPrice: stx, gas: gas, minerData: result.miner_info[item]});
    //console.log(rr)
    result.miner_info[item].RR = rr.toFixed(3);
  }
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



async function updateMonitorData() {
  console.log("updateMonitorData")
  //let result = await getMinerInfo()
  /*
  client.set("mining_info", JSON.stringify(result.mining_info))
  client.set("miner_info", JSON.stringify(result.miner_info))
  let blockcommits = handleBlockCommitInfo(result.block_commits)
  client.set("block_info", JSON.stringify(blockcommits))
  */
  return "ok"
}


app.get('/monitorIntegrate', async (req, res) => {

  let mining_info = await getMiningInfoFromRedis();
  let block_info = await getBlockInfoFromRedis();
  let miner_info = await getMinerInfoFromRedis();
  let miner_info1000 = await getMinerInfo1000FromRedis();
  let miner_info100 = await getMinerInfo100FromRedis();
  let btc_height = await getBtcHeightFromRedis()
  
  let miner_info_JSON = JSON.parse(miner_info);
  let miner_info1000_JSON = JSON.parse(miner_info1000);
  let miner_info100_JSON = JSON.parse(miner_info100);
  let mining_info_JSON = JSON.parse(mining_info);
  let block_info_JSON = JSON.parse(block_info);
  let mmData = packMiningMonitorData(mining_info_JSON, block_info_JSON, miner_info_JSON, miner_info1000_JSON, miner_info100_JSON );
  //console.log(mmData)

  mmData.btc_height = btc_height
  console.log(mmData.btc_height)
  res.send(mmData)
})


app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})

//update()
setInterval(function(){
  update();
}, 120000);


setInterval(function(){
  updateRecent()
  updateBitcoinInfo()
}, 600000)

//update();
//updateMonitorData();
//updateRecent()
