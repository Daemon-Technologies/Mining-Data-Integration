export function computeRR(params){
    const {btcPrice, stxPrice, gas, minerData} = params;
    const stxRewardAmountBonus = 2466
    const stxRewardAmountNormal = 1000
    //console.log(minerData)
    const {actual_win, total_mined, miner_burned, actual_win_bonus} = minerData;
    let earn = actual_win_bonus * stxRewardAmountBonus * stxPrice + (actual_win-actual_win_bonus) * stxRewardAmountNormal * stxPrice;
    let cost = (total_mined * gas + miner_burned) * btcPrice / 100000000;
    //console.log(earn, cost)
    return earn/cost - 1
}
