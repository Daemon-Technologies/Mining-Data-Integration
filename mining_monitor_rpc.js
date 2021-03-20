function packCurrentStatus(block_info_JSON){
    let current_block_height = block_info_JSON.length;
    let block_info20 = block_info_JSON.slice(-20)
    let burnFee20_arr = block_info20.map((value, index)=> { return value.sum_burn_fees })
    let burnFee20_avg = burnFee20_arr.reduce((acc, val) => acc + val, 0) / burnFee20_arr.length;
    
    let miner20_arr = block_info20.map((value, index)=> { return value.sum_miner_amount })
    let miner20_avg = miner20_arr.reduce((acc, val) => acc + val, 0) / miner20_arr.length;

    return {
        current_block: {
            stacks_block_height: block_info_JSON[current_block_height-1].stacks_block_height,
            bitcoin_block: {
                block_height: 654132,
                timestamp: 1600000 
            }
        },
        current_burn_fee: { data_20: burnFee20_arr, avg: burnFee20_avg },
        current_miner:{ data_20: miner20_arr, avg: miner20_avg }
    } 
}

function packMinerTable(block_info_JSON, mining_info_JSON){
    let current_block_height = block_info_JSON.length;
    let block_info20 = block_info_JSON.slice(-20);
    let mining_info50 = mining_info_JSON.slice(0, 50);

    let miner_burnfee20_arr = []
    block_info20.map((value, index) => {
        value.commit_value_list.map((vvalue, iindex) => {
            miner_burnfee20_arr.push({
                "height": parseInt(value.stacks_block_height),
                "address": vvalue.leader_key_address,
                "fee": parseInt(vvalue.burn_fee)
            })
        })
    })
    //console.log(miner_burnfee20_arr)

    return {
        table: mining_info50,
        minersBurnFee20:miner_burnfee20_arr
    }
}

function packBurnFeeArea(block_info_JSON){
    let current_block_height = block_info_JSON.length;
    let block_info_JSON200 = block_info_JSON.slice(-1000);
    //console.log(block_info_JSON200)
    let burnFeeTotal = new Array()
    
    block_info_JSON200.map((value, index)=> {
        let height = parseInt(value.stacks_block_height)
        //console.log(value.commit_value_list)
        value.commit_value_list.map((vvalue, iindex)=> {
            let item = {
                "height": height,
                "burn_fee": parseInt(vvalue.burn_fee)
            }
            if (!burnFeeTotal[vvalue.leader_key_address]){
                burnFeeTotal[vvalue.leader_key_address] = []
                burnFeeTotal[vvalue.leader_key_address].push(item)
            }
            else {
                item.burn_fee = item.burn_fee + burnFeeTotal[vvalue.leader_key_address].slice(-1)[0].burn_fee
                burnFeeTotal[vvalue.leader_key_address].push(item)
            }
            
        })
    })

    let burnFeeArea = []
    for (let key in burnFeeTotal){
        let data = burnFeeTotal[key];
        for (let index in data){
            let item = data[index]
            item.address = key;
            if (item.height - data[index-1].height === 0) {
                burnFeeArea[burnFeeArea.length - 1].burn_fee += item.burn_fee
                continue;
            }
            if (index != 0 && item.height-data[index-1].height > 1){
                //console.log("in", item, data[index-1])

                for (let i = data[index-1].height + 1; i < item.height; i++){
                    let missingItem = {}
                    missingItem.height = i;
                    missingItem.burn_fee = data[index-1].burn_fee;
                    missingItem.address = item.address
                    burnFeeArea.push(missingItem)
                }
            }

            let updateItem = data[index]
            updateItem.address = key
            burnFeeArea.push(updateItem)
        }
        if (current_block_height > data.slice(-1)[0].height){
            for (let i = data.slice(-1)[0].height + 1; i <= current_block_height; i++){
                let missingItem = {}
                missingItem.height = i;
                missingItem.burn_fee = data.slice(-1)[0].burn_fee;
                missingItem.address = key
                burnFeeArea.push(missingItem)
            }
        }

    }
    //console.log(burnFeeArea)

    return { data : burnFeeArea}

}

function packWinnerPie (miner_info, miner_info1000_JSON, miner_info100_JSON){
    console.log(miner_info)
    return { 
        all: miner_info.map((value, index) => {
            return {
                address: value.stx_address,
                number: value.actual_win,
                RR: value.RR
            }
        }), 
        "r1000": miner_info1000_JSON.map((value, index) => {
            return {
                address: value.stx_address,
                number: value.actual_win,
                RR: value.RR
            }
        }), 
        "r100": miner_info100_JSON.map((value, index) => {
            return {
                address: value.stx_address,
                number: value.actual_win,
                RR: value.RR
            }
        }) 
    }
}

function packRR (miner_info, miner_info1000_JSON, miner_info100_JSON){
    console.log(miner_info100_JSON)
    return { 
        all: [], 
        "r1000": [], 
        "r100": [] 
    }
}

export function packMiningMonitorData(mining_info_JSON, block_info_JSON, miner_info, miner_info1000_JSON, miner_info100_JSON){
    let result = {
        currentStatus: packCurrentStatus(block_info_JSON),
        minerTable: packMinerTable(block_info_JSON, mining_info_JSON),
        burnFeeArea: packBurnFeeArea(block_info_JSON),
        winnerPie:packWinnerPie(miner_info, miner_info1000_JSON, miner_info100_JSON),
        rateOfReturn: packRR(miner_info, miner_info1000_JSON, miner_info100_JSON)
    }
    console.log(result.winnerPie)
    return result;
}