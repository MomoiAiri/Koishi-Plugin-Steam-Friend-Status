import { Context } from "koishi"
import * as fs from 'fs'
import * as path from 'path'
import { imgpath } from "."

export async function getGroupHeadshot(ctx:Context, groupid:string):Promise<void>{
    const groupheadshot = await ctx.http.get(`http://p.qlogo.cn/gh/${groupid}/${groupid}/0`,{responseType:'arraybuffer'})
    const filepath = path.join(imgpath,`group${groupid}.jpg`)
    fs.writeFileSync(filepath,Buffer.from(groupheadshot))
}

export async function getBotHeadshot(ctx:Context, userid:string){
    const userheadshot = await ctx.http.get(`http://q.qlogo.cn/headimg_dl?dst_uin=${userid}&spec=640`,{responseType:'arraybuffer'})
    const filepath = path.join(imgpath,`bot${userid}.jpg`)
    fs.writeFileSync(filepath,Buffer.from(userheadshot))
}