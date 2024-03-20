import { Context, h, Session } from "koishi"
import { SteamUser } from "."
import path from "path"
import * as fs from 'fs'
import exp from "constants"

const steamIdOffset:number = 76561197960265728
const steamWebApiUrl = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/'
const steamstatus:{[key:number]:string} = {0:'离线',1:'在线',2:'忙碌',3:'离开',4:'打盹',5:'想交易',6:'想玩'}

interface SteamUserInfo{
    response:{
        players:{
            steamid:string,//用户ID
            communityvisibilitystate:number,//社区可见性状态
            profilestate:number,//用户是否配置了社区配置文件
            personaname:string,//玩家角色名
            commentpermission:number,//注释许可，如果设置，表示简档允许公开评论
            profileurl:string,//玩家Steam社区个人资料的完整URL
            avatar:string,//用户32*32大小头像
            avatarmedium:string,//用户64*64大小头像
            avatarfull:string,//用户184*184大小头像
            avatarhash:string,//头像哈希值
            lastlogoff:number,//用户上次联机的时间，以unix时间表示
            personastate:number,//用户的当前状态。0 -离线，1 -在线，2 -忙碌，3 -离开，4 -打盹，5 -想交易，6 -想玩。如果玩家的个人资料是私人的，这将始终是“0”，除非用户已将其状态设置为“正在交易”或“正在玩游戏”，因为即使个人资料是私人的，一个bug也会显示这些状态。
            realname:string,//真实姓名，如果玩家设置过了的话
            primaryclanid:string,//玩家的主要群组
            timecreated:number,//玩家帐户创建的时间
            personastateflags:number,//
            loccountrycode:string,//用户的居住国
            gameid:number,//玩家正在游玩的游戏ID
            gameserverip:string,//玩家正在游玩的游戏服务器地址
            gameextrainfo:string//玩家正在游玩的游戏名
        }[]
    }
}
//将steam好友码转换成steamid
function getSteamId(steamIdOrSteamFriendCode:string):string{
    if(!Number(steamIdOrSteamFriendCode)){
        return ''
    }
    const steamId = Number(steamIdOrSteamFriendCode)
    if(steamId < steamIdOffset){
        const result = BigInt(steamId) + BigInt(steamIdOffset)
        return result.toString()
    }
    else{
        return steamIdOrSteamFriendCode
    }
}
//绑定玩家
export async function bindPlayer(ctx:Context, friendcodeOrId:string, session:Session, steamApiKey:string):Promise<string>{
    if(!session.event.user?.id){
        return '未检测到用户ID'
    }
    const database = await ctx.database.get('SteamUser',{})
    if(database.length >= 100){
        return '该Bot已达到绑定玩家数量上限'
    }
    const dataindatabase = await ctx.database.get('SteamUser',{userId:Number(session.event.user?.id)})
    if( dataindatabase.length > 0){
        return `已绑定到ID为${dataindatabase[0].steamId}的玩家`
    }
    let steamId = getSteamId(friendcodeOrId)
    const playerData = (await getSteamUserInfo(ctx, steamApiKey, steamId)).response.players[0]
    if(playerData == undefined){
        return '无法获取到steam用户信息，请检查输入的steamId是否正确或者检查网络环境'
    }
    else{
        if(session.event.user?.id&&session.event.user?.name){
            const userdata:SteamUser = {
                userId:Number(session.event.user?.id),
                userName:session.event.user?.name,
                steamId:playerData.steamid,
                steamStatu:playerData.personastate,
                lastPlayedGame:playerData.gameextrainfo == undefined ? playerData.gameextrainfo : 'none',
                lastUpdateTime:Date.now().toString()
            }
            await ctx.database.create('SteamUser',userdata)
            const headshot = await ctx.http.get(playerData.avatarmedium,{responseType:'arraybuffer'})
            const filepath = path.join(__dirname,`img/steamuser${playerData.steamid}.jpg`)
            fs.writeFileSync(filepath,Buffer.from(headshot))
            return '绑定成功'
        }
    }
    return '绑定失败'
}
//解绑玩家
export async function unbindPlayer(ctx:Context, session:Session):Promise<string>{
    let userId = session.event.user?.id
    if(userId){
        const userData = await ctx.database.get('SteamUser',{userId:Number(userId)})
        if(userData.length === 1){
            const filepath = path.join(__dirname,`img/steamuser${userData[0].steamId}.jpg`)
            fs.unlink(filepath,(err)=>{console.log('删除头像出错',err)})
            await ctx.database.remove('SteamUser',{userId:Number(userId)})
            return '解绑成功'
        }
        else{
            return '用户未曾绑定，无法解绑'
        }
    }
    else{
        return '无法获取用户ID'
    }
}
//循环查询数据库中玩家信息
export async function getSteamUserInfoByDatabase(ctx:Context, steamApiKey:string):Promise<SteamUserInfo>{
    const userInfo = await ctx.database.get('SteamUser',{})
    let steamIds:string[] = []
    for(let i = 0; i < userInfo.length; i++){
        steamIds.push(userInfo[i].steamId.toString())
    }
    const requestUrl = `${steamWebApiUrl}?key=${steamApiKey}&steamIds=${steamIds.join(',')}`
    const response = await ctx.http.get(requestUrl)
    if(!response || response.response.players.length === 0){
        return undefined
    }
    return response as SteamUserInfo
}
//检查用户是否存在
async function getSteamUserInfo(ctx:Context, steamApiKey:string, steamid:string):Promise<SteamUserInfo>{
    const requestUrl = `${steamWebApiUrl}?key=${steamApiKey}&steamIds=${steamid}`
    const response = await ctx.http.get(requestUrl)
    console.log(response.status)
    if(!response || response.response.players.length === 0){
        return undefined
    }
    return response as SteamUserInfo
}
//检查玩家状态是否变化
export async function getUserStatusChanged(ctx:Context, steamUserInfo:SteamUserInfo):Promise<Array<any>>{
    if(steamUserInfo === undefined) return
    let msgArray:Array<any> = []
    for(let i = 0; i < steamUserInfo.response.players.length; i++){
        const playerTemp = steamUserInfo.response.players[i]
        const userData = (await ctx.database.get('SteamUser',{steamId:playerTemp.steamid}))[0]
        //开始玩了
        if(userData.lastPlayedGame == 'none' && playerTemp.gameextrainfo){
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: playerTemp.gameextrainfo})
            msgArray.push(`${userData.userName}开始玩${playerTemp.gameextrainfo}了\n`)
            continue
        }
        //换了一个游戏玩
        if(userData.lastPlayedGame != playerTemp.gameextrainfo && userData.lastPlayedGame != 'none'){
            const lastPlayedGame = userData.lastPlayedGame
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: playerTemp.gameextrainfo})
            msgArray.push(`${userData.userName}不玩${lastPlayedGame}了，开始玩${playerTemp.gameextrainfo}了\n`)
            continue
        }
        //不玩辣
        if(!playerTemp.gameextrainfo && userData.lastPlayedGame != 'none'){
            const lastPlayedGame = userData.lastPlayedGame
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: 'none'})
            msgArray.push(`${userData.userName}停止玩${lastPlayedGame}了\n`)
            continue
        }
    }
    return msgArray
}
//获取好友状态图片
export async function getFriendStatusImg(ctx:Context, userData:SteamUserInfo, botid:string){
    const gamingUsers = userData.response.players.filter(player => player.personastate == 1 && player.gameextrainfo)
    const onlineUsers = userData.response.players.filter(player => player.personastate !=0 && !player.gameextrainfo)
    const offlineUsers = userData.response.players.filter(player => player.personastate == 0)
    const url = path.join(__dirname,'html/steamFriendList.html')
    const page = await ctx.puppeteer.page()
    page.setViewport({width:227,height:0})
    await page.goto(url)
    await page.evaluate((botid,gamingUsers,onlineUsers,offlineUsers,steamstatus)=>{
        var bot = document.getElementsByClassName('bot')[0]
        var botHeadshot = bot.querySelector('img')
        var botName = bot.querySelector('p')
        var gamingList = document.getElementById('ul-gaming')
        var onlineList = document.getElementById('ul-online')
        var offlineList = document.getElementById('ul-offline')
        var titles = document.getElementsByClassName('title')
        botHeadshot.setAttribute('src',`../img/bot${botid}.jpg`)
        botName.innerHTML = `<b>${botid}</b>`
        titles[0].innerHTML = `游戏中（${gamingUsers.length}）`
        titles[1].innerHTML = `在线好友（${onlineUsers.length}）`
        titles[2].innerHTML = `离线好友（${offlineUsers.length}）`
        for(let i = 0; i < gamingUsers.length; i++){
            const li = document.createElement('li')
            li.setAttribute('class','friend')
            li.innerHTML = `<img src="../img/steamuser${gamingUsers[i].steamid}.jpg" class="headshot-online">
                            <div class="name-and-status">
                                <p class="name-gaming">${gamingUsers[i].personaname}</p>
                                <p class="status-gaming">${gamingUsers[i].gameextrainfo}</p>
                            </div>`
            gamingList.appendChild(li)
        }
        for(let i = 0; i < onlineUsers.length; i++){
            const li = document.createElement('li')
            li.setAttribute('class','friend')
            li.innerHTML = `<img src="../img/steamuser${onlineUsers[i].steamid}.jpg" class="headshot-online">
                            <div class="name-and-status">
                                <p class="name-online">${onlineUsers[i].personaname}</p>
                                <p class="status-online">${steamstatus[onlineUsers[i].personastate]}</p>
                            </div>`
            onlineList.appendChild(li)
        }
        for(let i = 0; i < offlineUsers.length; i++){
            const li = document.createElement('li')
            li.setAttribute('class','friend')
            li.innerHTML = `<img src="../img/steamuser${offlineUsers[i].steamid}.jpg" class="headshot-online">
                            <div class="name-and-status">
                                <p class="name-offline">${offlineUsers[i].personaname}</p>
                                <p class="status-offline">${steamstatus[offlineUsers[i].personastate]}</p>
                            </div>`
            offlineList.appendChild(li)
        }
    },botid,gamingUsers,onlineUsers,offlineUsers,steamstatus)
    const image = await page.screenshot({fullPage:true,type:'png',encoding:'binary'})
    const buffer = Buffer.from(image)
    return h.image(buffer,'image/png')
}

export async function steamInterval(ctx:Context, apiKey:string){
    const userdata = await getSteamUserInfoByDatabase(ctx, apiKey)
    const messageList:Array<any> = await getUserStatusChanged(ctx, userdata)
    const channel = await ctx.database.get('channel',{})
    let tempBotId = ''
    let tempImg = undefined
    messageList.push(tempImg)
    const supportPlatform = ['onebot','red']
    for(let i = 0; i < channel.length; i++){
        if(tempBotId!=channel[i].assignee && supportPlatform.includes(channel[i].platform)){
            tempBotId = channel[i].assignee
            tempImg = await getFriendStatusImg(ctx, userdata, tempBotId)
        }
        if(channel[i].usingSteam){
            ctx.bots[`${channel[i].platform}:${channel[i].assignee}`].sendMessage(channel[i].id,messageList)
        }
    }
}