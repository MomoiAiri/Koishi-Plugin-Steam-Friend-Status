import { Context } from "koishi";
import { CustomPromisifyLegacy } from "util";
import Puppeteer from 'koishi-plugin-puppeteer'

export async function getScreenshot(ctx:Context, url:string, maxWidth:number = 0):Promise<Buffer>{
    const page = await ctx.puppeteer.page()
    page.setViewport({width:maxWidth,height:0})
    await page.goto(url)
    const image = await page.screenshot({fullPage:true,type:'png',encoding:'binary'})
    return image
}