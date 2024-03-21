import { Context } from "koishi"
import * as fs from 'fs'
import * as path from 'path'

export async function getGroupHeadshot(ctx:Context, groupid:string):Promise<void>{
    const groupheadshot = await ctx.http.get(`http://p.qlogo.cn/gh/${groupid}/${groupid}/0`,{responseType:'arraybuffer'})
    const filepath = path.join(__dirname,`img/group${groupid}.jpg`)
    fs.writeFileSync(filepath,Buffer.from(filepath))
}

export async function getUserHeadshot(ctx:Context, userid:string){
    const groupheadshot = await ctx.http.get(`http://q.qlogo.cn/headimg_dl?dst_uin=${userid}&spec=640`,{responseType:'arraybuffer'})
    const filepath = path.join(__dirname,`img/group${userid}.jpg`)
    fs.writeFileSync(filepath,Buffer.from(filepath))
}