import { Context } from "koishi"

const steamIdOffset:number = 76561197960265728
const steamWebApiUrl = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/'

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
            loccountrycode:string//用户的居住国
        }[]
    }
}

function getSteamId(steamIdOrSteamFriendCode:string):string{
    if(!Number(steamIdOrSteamFriendCode)){
        return ''
    }
    const steamId = Number(steamIdOrSteamFriendCode)
    if(steamId < steamIdOffset){
        return (steamId + steamIdOffset).toString()
    }
    else{
        return steamIdOrSteamFriendCode
    }
}

async function getSteamUserInfo(ctx:Context, steamIds:string[]):Promise<SteamUserInfo>{
    ctx.http.get(steamWebApiUrl)
    return undefined
}