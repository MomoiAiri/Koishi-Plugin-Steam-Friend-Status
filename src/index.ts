import { Context, Schema, h } from 'koishi'
import Puppeteer from 'koishi-plugin-puppeteer'
import { bindPlayer, unbindPlayer } from './steam'

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

  ctx.command('截图')
  .action(async({session})=>{
    const page = await ctx.puppeteer.page()
    page.setViewport({width:227,height:0})
    await page.goto('D:/Code/koishi-app/external/steam-friend-status/src/html/steamFriendList.html')
    const image = await page.screenshot({fullPage:true,type:'png'})
    const buffer = Buffer.from(image)
    return h.image(buffer,'image/png')
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
