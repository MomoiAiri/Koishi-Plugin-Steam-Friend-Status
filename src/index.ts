import { Context, Schema, h } from 'koishi'
import Puppeteer from 'koishi-plugin-puppeteer'

export const name = 'steam-friend-status'

export interface Config {}

export const Config: Schema<Config> = Schema.object({})
export const inject = ['puppeteer']

export function apply(ctx: Context) {
  // write your plugin here
  ctx.command('截图')
  .action(async({session})=>{
    const page = await ctx.puppeteer.page()
    page.setViewport({width:227,height:0})
    await page.goto('D:/Code/koishi-app/external/steam-friend-status/src/html/steamFriendList.html')
    const image = await page.screenshot({fullPage:true,type:'png'})
    const buffer = Buffer.from(image)
    return h.image(buffer,'image/png')
  })
}
