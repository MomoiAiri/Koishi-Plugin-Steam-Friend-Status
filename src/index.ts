import { Context, Schema, h } from 'koishi'
import Puppeteer from 'koishi-plugin-puppeteer'
import { bindPlayer, getFriendStatusImg, getSelfFriendcode, getSteamUserInfoByDatabase, selectUsersByGroup, steamInterval, unbindAll, unbindPlayer, updataPlayerHeadshots } from './steam'
import * as fs from 'fs'
import * as path from 'path'
import { getGroupHeadshot, getBotHeadshot } from './util'

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
  userId:string,
  userName:string,//用户名
  steamId:string,
  steamName:string,//Steam用户名
  effectGroups:string[],
  lastPlayedGame:string,
  lastUpdateTime:string,
}
export interface Config{
  SteamApiKey:string,
  interval:number,
  useSteamName:boolean,
  broadcastWithImage,
}

export const Config: Schema<Config> = Schema.object({
  SteamApiKey: Schema.string().description('Steam API Key，获取方式：https://partner.steamgames.com/doc/webapi_overview/auth').required(),
  interval: Schema.number().default(300).description('查询间隔,单位：秒'),
  useSteamName: Schema.boolean().default(true).description('使用Steam昵称,关闭时使用的QQ昵称'),
  broadcastWithImage: Schema.boolean().default(true).description('播报时附带图片')
})

export function apply(ctx: Context, config:Config) {  
  // write your plugin here
  ctx.model.extend('channel', {
    usingSteam:{type:'boolean',initial:false,nullable:false}
  })

  ctx.model.extend('SteamUser', {
    userId: 'string',
    userName: 'string',
    steamId: 'string',
    steamName:'string',
    effectGroups: 'list',
    lastPlayedGame: 'string',
    lastUpdateTime: 'string',
  },{primary:'userId'})

  initBotsHeadshots(ctx);
  ctx.setInterval(function(){steamInterval(ctx,config)},config.interval * 1000)

  ctx.command('绑定steam <steamid:text>')
  .usage('绑定steam账号，参数可以是好友码也可以是ID')
  .action(async({session},steamid)=>{
    if(steamid == undefined){
      return '缺少参数'
    }
    const result = await bindPlayer(ctx,steamid,session,config.SteamApiKey)
    return result
  })

  ctx.command('解绑steam')
  .usage('解绑steam账号')
  .action(async({session})=>{
    const result = await unbindPlayer(ctx,session)
    return result
  })

  ctx.command('解绑全部steam')
  .usage('解绑在所有群的steam账号')
  .action(async({session})=>{
    const result = await unbindAll(ctx,session)
    return result
  })
  
  ctx.command('steam <word:text>')
  .usage('开启或关闭群通报，输入[steam on/off]或者[开启/关闭steam]来开关')
  .shortcut('开启steam', { args: ['on'] })
  .shortcut('关闭steam', { args: ['off'] })
  .channelFields(['usingSteam'])
  .userFields(['authority'])
  .action(async({session},text)=>{
    // 获取 session.event.member.roles 和 session.author.roles
    const eventMemberRoles = session.event.member.roles || [];
    const authorRoles = session.author.roles || [];
    // 合并两个角色列表并去重
    const roles = Array.from(new Set([...eventMemberRoles, ...authorRoles]));
    // 检查是否有所需角色
    const hasRequiredRole = roles.includes('admin') || roles.includes('owner');
    // 检查用户是否有足够的权限：authority > 1 或者角色是 admin 或 owner
    if (session.user.authority > 1 || hasRequiredRole) {
      switch (text) {
        case "on":
        case "开启":
          session.channel.usingSteam = true;
          return "开启成功";
        case "off":
        case "关闭":
          session.channel.usingSteam = false;
          return "关闭成功";
        default:
          return "无效指令";
      }
    } else {
      return "您没有权限执行此操作";
    }
  })

  ctx.command('更新steam')
  .usage('更新绑定的steam用户的头像')
  .action(async({session})=>{
    await updataPlayerHeadshots(ctx,config.SteamApiKey)
    return "更新成功"
  })
  
  ctx.command('看看steam')
  .usage('查看当前绑定过的玩家状态')
  .action(async({session})=>{
    const allUserData = await ctx.database.get('SteamUser',{})
    const users = await selectUsersByGroup(allUserData,session.event.channel.id)
    if(users.length === 0){
      return '本群无人绑定'
    }
    const data = await getSteamUserInfoByDatabase(ctx,users,config.SteamApiKey)
    return await getFriendStatusImg(ctx,data,session.event.selfId)
  })

  ctx.command('steam信息')
  .usage('查看自己的好友码和ID')
  .action(async({session})=>{
    return `你的好友码为: ${await getSelfFriendcode(ctx,session)}`
  })
}
//初始化QQ相关平台的bot头像
async function initBotsHeadshots(ctx:Context){
  const channel = await ctx.database.get('channel',{})
  let tempbots = []
  for(let i = 0; i < channel.length; i++){
    const platforms = ['onebot','red','chronocat']
    if(platforms.includes(channel[i].platform)){
      tempbots.push(channel[i].assignee)
      // if(channel[i].usingSteam){
      //   await getGroupHeadshot(ctx,channel[i].id)
      // }
    }
  }
  const bots = [...new Set(tempbots)]
  for(let i = 0; i < bots.length; i++){
    await getBotHeadshot(ctx,bots[i])
  }
}