export function computeRR(params){
    const {btcPrice, stxPrice, gas, minerData} = params;
    const stxRewardAmount = 2466
    //console.log(minerData)
    const {actual_win, total_mined, miner_burned} = minerData;
    let earn = actual_win * stxRewardAmount * stxPrice;
    let cost = (total_mined * gas + miner_burned) * btcPrice / 100000000;
    //console.log(earn, cost)
    return earn/cost - 1
}
