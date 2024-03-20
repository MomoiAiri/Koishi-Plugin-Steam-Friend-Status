import { Context, Schema, h } from 'koishi'
import Puppeteer from 'koishi-plugin-puppeteer'
import { bindPlayer, getFriendStatusImg, getSteamUserInfoByDatabase, steamInterval, unbindPlayer } from './steam'
import * as fs from 'fs'
import * as path from 'path'

export const name = 'steam-friend-status'

export const inject = ['puppeteer']
declare module 'koishi'{
  interface Tables{
    SteamUser:SteamUser
  }
  interface Channel{
    usingSteam:boolean,
  }
}
export interface SteamUser{
  userId:number,
  userName:string,//用户名
  steamId:string,
  steamStatu:number,
  lastPlayedGame:string,
  lastUpdateTime:string,
}
export interface Config{
  SteamApiKey:string,
  interval:number
}

export const Config: Schema<Config> = Schema.object({
  SteamApiKey: Schema.string().description('Steam API Key').required(),
  interval: Schema.number().default(300000).description('查询间隔'),
})

export function apply(ctx: Context, config:Config) {  
  // write your plugin here
  ctx.model.extend('channel', {
    usingSteam:{type:'boolean',initial:false,nullable:false}
  })

  ctx.model.extend('SteamUser', {
    userId: 'unsigned',
    userName: 'string',
    steamId: 'string',
    steamStatu: 'integer',
    lastPlayedGame: 'string',
    lastUpdateTime: 'string',
  },{primary:'userId'})

  initBotsHeadshots(ctx);

  const si = setInterval(function(){steamInterval(ctx,config.SteamApiKey)},1*60*1000)

  ctx.command('截图')
  .action(async({session})=>{
    const data = await getSteamUserInfoByDatabase(ctx,config.SteamApiKey)
    return await getFriendStatusImg(ctx,data,'762026456')
  })

  ctx.command('绑定steam <steamid:text>')
  .action(async({session},steamid)=>{
    const result = await bindPlayer(ctx,steamid,session,config.SteamApiKey)
    return result
  })

  ctx.command('解绑steam')
  .action(async({session})=>{
    const result = await unbindPlayer(ctx,session)
    return result
  })
  
}

async function initBotsHeadshots(ctx:Context){
  const channel = await ctx.database.get('channel',{})
  let tempbots = []
  for(let i = 0; i < channel.length; i++){
    const platforms = ['onebot','red']
    if(platforms.includes(channel[i].platform)){
      tempbots.push(channel[i].assignee)
    }
  }
  const bots = [...new Set(tempbots)]
  for(let i = 0; i < bots.length; i++){
    const headshot = await ctx.http.get(`http://q.qlogo.cn/headimg_dl?dst_uin=${bots[i]}&spec=640`,{responseType:'arraybuffer'})
    const filepath = path.join(__dirname,`img/bot${bots[i]}.jpg`)
    fs.writeFileSync(filepath,Buffer.from(headshot))
  }
}