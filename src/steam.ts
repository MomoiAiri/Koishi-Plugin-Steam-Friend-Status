import { Context, h, Session, sleep } from "koishi"
import { Config, SteamUser } from "."
import path from "path"
import * as fs from 'fs'
import exp from "constants"
import { group } from "console"

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
    const userid = session.event.user.id
    const channelid = session.event.channel.id
    if(!userid || !channelid){
        return '未检测到用户ID或群ID'
    }
    const database = await ctx.database.get('SteamUser',{})
    if(database.length >= 100){
        return '该Bot已达到绑定玩家数量上限'
    }
    let steamId = getSteamId(friendcodeOrId)
    const playerData = (await getSteamUserInfo(ctx, steamApiKey, steamId)).response.players[0]
    if(playerData == undefined){
        return '无法获取到steam用户信息，请检查输入的steamId是否正确或者检查网络环境'
    }
    const userDataInDatabase = await ctx.database.get('SteamUser',{userId:userid})
    if(userDataInDatabase.length === 0){
        const userData:SteamUser = {
            userId:userid,
            userName:session.event.user.name != undefined ? session.event.user.name:session.event.user.id,
            steamId:playerData.steamid,
            steamName:playerData.personaname,
            effectGroups:[session.event.channel.id],
            lastPlayedGame:playerData.gameextrainfo == undefined ? playerData.gameextrainfo : undefined,
            lastUpdateTime:Date.now().toString()
        }
        await ctx.database.create('SteamUser',userData)
            const headshot = await ctx.http.get(playerData.avatarmedium,{responseType:'arraybuffer'})
            const filepath = path.join(__dirname,`img/steamuser${playerData.steamid}.jpg`)
            fs.writeFileSync(filepath,Buffer.from(headshot))
            return '绑定成功'
    }
    if( userDataInDatabase[0].effectGroups.includes(channelid)){
        return `已在该群绑定过，无需再次绑定`
    }
    else{
        const effectGroups = userDataInDatabase[0].effectGroups
        effectGroups.push(channelid)
        if(session.event.user?.id){
            await ctx.database.set('SteamUser',{userId:userid},{effectGroups:effectGroups})
            return '绑定成功'
        }
    }
    return '绑定失败'
}
//解绑玩家
export async function unbindPlayer(ctx:Context, session:Session):Promise<string>{
    const userid = session.event.user?.id
    const channelid = session.event.channel.id
    if(!userid || !channelid){
        return '未获取到用户ID或者群ID，解绑失败'
    }
    const userData = (await ctx.database.get('SteamUser',{userId:userid}))[0]
    if(userData && userData.effectGroups.includes(channelid)){
        if(userData.effectGroups.length == 1){
            const filepath = path.join(__dirname,`img/steamuser${userData.steamId}.jpg`)
            fs.unlink(filepath,(err)=>{console.log('删除头像出错',err)})
            ctx.database.remove('SteamUser',{userId:userid})
        }
        const effectGroups = userData.effectGroups
        effectGroups.splice(effectGroups.indexOf(channelid),1)
        await ctx.database.set('SteamUser',{userId:userid},{effectGroups:effectGroups})
        return '解绑成功'
    }
    else{
        return '用户未曾绑定，无法解绑'
    }
}
//解绑全部
export async function unbindAll(ctx:Context, session:Session):Promise<string>{
    const userid = session.event.user?.id
    if(!userid){
        return '未获取到用户ID，解绑失败'
    }
    const userData = (await ctx.database.get('SteamUser',{userId:userid}))
    if(userData.length < 1){
        return '用户未曾绑定，无法解绑'
    }
    const filepath = path.join(__dirname,`img/steamuser${userData[0].steamId}.jpg`)
    fs.unlink(filepath,(err)=>{console.log('删除头像出错',err)})
    await ctx.database.remove('SteamUser',{userId:userid})
    return '解绑成功'
}
//查询数据库中玩家信息
export async function getSteamUserInfoByDatabase(ctx:Context, steamusers:SteamUser[], steamApiKey:string):Promise<SteamUserInfo>{
    let steamIds:string[] = []
    for(let i = 0; i < steamusers.length; i++){
        steamIds.push(steamusers[i].steamId.toString())
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
    if(!response || response.response.players.length === 0){
        return undefined
    }
    return response as SteamUserInfo
}
//检查玩家状态是否变化
export async function getUserStatusChanged(ctx:Context, steamUserInfo:SteamUserInfo, usingSteamName:boolean):Promise<{[key:string]:string}>{
    if(steamUserInfo === undefined) return
    let msgArray:{[key:string]:string} = {}
    for(let i = 0; i < steamUserInfo.response.players.length; i++){
        const playerTemp = steamUserInfo.response.players[i]
        const userData = (await ctx.database.get('SteamUser',{steamId:playerTemp.steamid}))[0]
        //如果steam名称有更改
        if(userData.steamName!== playerTemp.personaname){
            ctx.database.set('SteamUser', {steamId: playerTemp.steamid}, {steamName: playerTemp.personaname})
        }
        //开始玩了
        if(!userData.lastPlayedGame && playerTemp.gameextrainfo){
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: playerTemp.gameextrainfo})
            msgArray[userData.userId] = (`${usingSteamName?playerTemp.personaname:userData.userName} 开始玩 ${playerTemp.gameextrainfo} 了\n`)
            continue
        }
        //换了一个游戏玩
        if(userData.lastPlayedGame != playerTemp.gameextrainfo && userData.lastPlayedGame && playerTemp.gameextrainfo){
            const lastPlayedGame = userData.lastPlayedGame
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: playerTemp.gameextrainfo})
            msgArray[userData.userId] = (`${usingSteamName?playerTemp.personaname:userData.userName} 不玩 ${lastPlayedGame} 了，开始玩 ${playerTemp.gameextrainfo} 了\n`)
            continue
        }
        //不玩辣
        if(!playerTemp.gameextrainfo && userData.lastPlayedGame){
            const lastPlayedGame = userData.lastPlayedGame
            await ctx.database.set('SteamUser', {steamId: userData.steamId}, {lastPlayedGame: ''})
            msgArray[userData.userId] = (`${usingSteamName?playerTemp.personaname:userData.userName} 不玩 ${lastPlayedGame} 了\n`)
            continue
        }
    }
    return msgArray
}
//获取好友状态图片
export async function getFriendStatusImg(ctx:Context, userData:SteamUserInfo, botid:string){
    const gamingUsers = userData.response.players.filter(player => player.gameextrainfo)
    const onlineUsers = userData.response.players.filter(player => player.personastate !=0 && !player.gameextrainfo)
    onlineUsers.sort((a,b)=>a.personastate - b.personastate)
    const offlineUsers = userData.response.players.filter(player => player.personastate == 0)
    const url = path.join(__dirname,'html/steamFriendList.html')
    const response = await ctx.http.get(`https://www.devtool.top/api/qq/info?qq=${botid}`)
    let botname = ''
    if(response.code === 200){
        botname =response.data.nick
    }
    const page = await ctx.puppeteer.page()
    await page.setViewport({width:227,height:224 + userData.response.players.length * 46})
    await page.goto(url)
    await page.evaluate((botid,botname,gamingUsers,onlineUsers,offlineUsers,steamstatus)=>{
        var bot = document.getElementsByClassName('bot')[0]
        var botHeadshot = bot.querySelector('img')
        var botName = bot.querySelector('p')
        var gamingList = document.getElementById('ul-gaming')
        var onlineList = document.getElementById('ul-online')
        var offlineList = document.getElementById('ul-offline')
        var titles = document.getElementsByClassName('title')
        botHeadshot.setAttribute('src',`../img/bot${botid}.jpg`)
        botName.innerHTML = `<b>${botname}</b>`
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
            li.innerHTML = `<img src="../img/steamuser${offlineUsers[i].steamid}.jpg" class="headshot-offline">
                            <div class="name-and-status">
                                <p class="name-offline">${offlineUsers[i].personaname}</p>
                                <p class="status-offline">${steamstatus[offlineUsers[i].personastate]}</p>
                            </div>`
            offlineList.appendChild(li)
        }
    },botid,botname,gamingUsers,onlineUsers,offlineUsers,steamstatus)
    const image = await page.screenshot({fullPage:true,type:'png',encoding:'binary'})
    return h.image(image,'image/png')
}
//循环检测玩家状态
export async function steamInterval(ctx:Context, config:Config){
    const allUserData = await ctx.database.get('SteamUser',{})
    const userdata = await getSteamUserInfoByDatabase(ctx, allUserData, config.SteamApiKey)
    const changeMessage:{[key:string]:string} = await getUserStatusChanged(ctx, userdata, config.useSteamName)
    if(Object.keys(changeMessage).length > 0){
        const supportPlatform = ['onebot','red','chronocat']
        const channel = await ctx.database.get('channel',{usingSteam:true,platform:supportPlatform})
        for(let i = 0; i < channel.length; i++){
            const groupMessage:Array<string|h> = []
            for(let j = 0; j < allUserData.length; j++){
                if(allUserData[j].effectGroups.includes(channel[i].id) && changeMessage[allUserData[j].userId]){
                    groupMessage.push(changeMessage[allUserData[j].userId])
                }
            }
            const userInGroup = selectApiUsersByGroup(userdata,allUserData,channel[i].id)
            if(groupMessage.length > 0){
                if(config.useSteamName){
                    const image = await getFriendStatusImg(ctx, userInGroup, channel[i].assignee)
                    groupMessage.push(image)
                }
                const bot = ctx.bots[`${channel[i].platform}:${channel[i].assignee}`]
                if(bot){
                    bot.sendMessage(channel[i].id,groupMessage)
                }
            }
        }
    }
}
//更新头像信息
export async function updataPlayerHeadshots(ctx:Context, apiKey:string){
    const allUserData = await ctx.database.get('SteamUser',{})
    const userdata = (await getSteamUserInfoByDatabase(ctx, allUserData, apiKey)).response.players
    for(let i = 0; i < userdata.length; i++){
        const headshot = await ctx.http.get(userdata[i].avatarmedium,{responseType:'arraybuffer'})
        const filepath = path.join(__dirname,`img/steamuser${userdata[i].steamid}.jpg`)
        fs.writeFileSync(filepath,Buffer.from(headshot))
    }
}
//获取自己的好友码
export async function getSelfFriendcode(ctx:Context, session:Session):Promise<string>{
    const userdata = await ctx.database.get('SteamUser',{userId:session.event.user.id})
    if(userdata.length==0){
        return '用户未绑定,无法获得好友码'
    }
    if(userdata[0].userName!=session.event.user.name){
        await ctx.database.set('SteamUser',{userId:session.event.user.id},{userName:session.event.user.name})
    }
    const steamID = userdata[0].steamId
    const steamFriendCode = BigInt(steamID) - BigInt(steamIdOffset)
    return steamFriendCode.toString()
}
//筛选在特定群中的用户
export function selectUsersByGroup(steamusers:SteamUser[], groupid:string):SteamUser[]{
    const users = steamusers.filter(user => user.effectGroups.includes(groupid))
    return users
}
//根据群号筛选从API中获取的用户数据
export function selectApiUsersByGroup(steamusers_api:SteamUserInfo, steamusers_database:SteamUser[], groupid:string):SteamUserInfo{
    let result:SteamUserInfo = {
        response:{
            players:[]
        }
    }
    const databaseUsers = selectUsersByGroup(steamusers_database, groupid)
    for(let i = 0; i < steamusers_api.response.players.length; i++){
        const tempplayer = steamusers_api.response.players[i]
        if(databaseUsers.find(user => user.steamId == tempplayer.steamid)){
            result.response.players.push(tempplayer)
        }
    }
    return result
}   

export async function getAllUserFriendCodesInGroup(ctx:Context, groupid:string):Promise<string>{
    let result = []
    const allUserData = await ctx.database.get('SteamUser',{})
    const groupUserData = selectUsersByGroup(allUserData, groupid)
    for(let i = 0; i < groupUserData.length; i++){
        result.push(`${groupUserData[i].userName}: ${(BigInt(groupUserData[i].steamId)-BigInt(steamIdOffset)).toString()}`)
    }
    if(result.length == 0){
        return '本群没有用户绑定'
    }
    else{
        return result.join('\n')
    }
}