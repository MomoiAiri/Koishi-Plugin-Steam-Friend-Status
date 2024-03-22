# koishi-plugin-steam-friend-status

[![npm](https://img.shields.io/npm/v/koishi-plugin-steam-friend-status?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-steam-friend-status)

自动播报好友steam状态插件

## 灵感来源

[nonebot-plugin-steam-info](https://github.com/zhaomaoniu/nonebot-plugin-steam-info)  
☀️赞美zmn☀️

## 指令说明
| 指令 | 功能说明 |
|--|--|
| 绑定steam <steam好友码/steamID> | 将用户的steam账号绑定至发送指令的群 |
| 解绑steam | 解除用户在发送指令的群的绑定信息 |
| steam信息 | 返回用户自己的好友码 |
| 看看steam | 查看当前群所有绑定用户的状态 |

## 配置说明
| 配置项  | 默认值 | 说明 |
|--|--|--|
| SteamApiKey | 无 | 用户查询信息的apikey，可以从[这里](https://partner.steamgames.com/doc/webapi_overview/auth)获取|
| interval | 300 | 单位（秒），自动查询信息的时间间隔 |
| useSteamName | false | 播报时使用玩家昵称，false为QQ昵称，true为steam昵称 |

## 其他说明
- 需要启用koishi的puppeteer功能才能正常加载，如需调整字体格式，可以在node_modules中找到插件的位置，修改/css/steamFriendList.css文件。  
- 考虑到隐私，每个群的绑定信息独立，别人无法看到你在未绑定的群中的状态，因此需要再多个群使用时需要多次绑定